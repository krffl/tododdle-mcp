import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getDefaultManagedUploadRoot, parseUploadRoots } from '../dist/config.js'
import {
  createValidatingLookup,
  fetchWithSafeRedirects,
  prepareUploadSource,
} from '../dist/upload-source.js'

test('local upload sources accept optional approved roots without deleting originals', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-source-test-'))
  const filePath = join(directory, 'file.txt')
  await writeFile(filePath, 'hello')
  try {
    const source = await prepareUploadSource({ filePath }, [directory], 100)
    assert.equal(source.fileName, 'file.txt')
    assert.equal(source.fileSize, 5)
    assert.equal(source.contentType, 'text/plain')
    await source.cleanup(true)
    assert.equal(await readFile(filePath, 'utf8'), 'hello')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('managed root is the real system temp directory and cleans up only after confirmed success', async () => {
  const managedRoot = getDefaultManagedUploadRoot()
  assert.equal(managedRoot, await realpath(tmpdir()))
  const stagingDirectory = await mkdtemp(join(tmpdir(), 'tododdle-managed-test-'))
  const filePath = join(stagingDirectory, 'file.txt')
  try {
    await writeFile(filePath, 'hello', { mode: 0o600 })

    const retained = await prepareUploadSource({ filePath }, [], 100, managedRoot)
    assert.equal(retained.filePath, await realpath(filePath))
    await retained.cleanup(false)
    assert.equal(await readFile(filePath, 'utf8'), 'hello')

    const confirmed = await prepareUploadSource({ filePath }, [], 100, managedRoot)
    await confirmed.cleanup(true)
    await assert.rejects(lstat(filePath), { code: 'ENOENT' })
    await assert.rejects(lstat(stagingDirectory), { code: 'ENOENT' })
    // Cleanup never removes the system temp directory itself.
    assert.ok((await lstat(managedRoot)).isDirectory())
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }
})

test('rejects symlinks, even to files inside allowed roots', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-symlink-test-'))
  const target = join(directory, 'target.txt')
  const link = join(directory, 'linked.txt')
  try {
    await writeFile(target, 'private')
    await symlink(target, link)
    await assert.rejects(
      prepareUploadSource({ filePath: link }, [], 100, getDefaultManagedUploadRoot()),
      /regular file/
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects directories as upload sources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-dir-test-'))
  try {
    await assert.rejects(
      prepareUploadSource({ filePath: directory }, [], 100, getDefaultManagedUploadRoot()),
      /regular file/
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects files outside the temp directory and approved roots', async () => {
  const allowed = await mkdtemp(join(tmpdir(), 'tododdle-allowed-test-'))
  const outside = await mkdtemp(join(process.cwd(), '.tododdle-outside-test-'))
  const filePath = join(outside, 'file.txt')
  try {
    await writeFile(filePath, 'hello')
    const managedRoot = getDefaultManagedUploadRoot()
    await assert.rejects(
      prepareUploadSource({ filePath }, [allowed], 100, managedRoot),
      error => error.message.includes(`the system temporary directory (${managedRoot})`)
        && error.message.includes(`the approved upload root ${allowed}`)
        && !error.message.includes('do not exist yet')
    )
    // Regression: a configured root that does not exist was only reported as a raw ENOENT.
    const missingRoot = join(allowed, 'not-created-yet')
    await assert.rejects(
      prepareUploadSource({ filePath }, [missingRoot], 100, managedRoot),
      error => error.message.includes(`These approved upload roots do not exist yet: ${missingRoot}`)
        && error.message.includes('TODODDLE_UPLOAD_ROOTS')
    )
    const source = await prepareUploadSource({ filePath }, [outside], 100, getDefaultManagedUploadRoot())
    assert.equal(source.fileSize, 5)
  } finally {
    await rm(allowed, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('explains a missing local file instead of a raw ENOENT', async () => {
  const managedRoot = getDefaultManagedUploadRoot()
  const filePath = join(tmpdir(), `tododdle-missing-${Date.now()}.png`)
  await assert.rejects(
    prepareUploadSource({ filePath }, [], 100, managedRoot),
    error => error.message.startsWith(`Local file not found: ${filePath}.`)
      && error.message.includes(managedRoot)
      && !error.message.includes('ENOENT')
  )
})

test('infers the SVG content type from the extension', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-svg-test-'))
  const filePath = join(directory, 'galaxy-map.svg')
  await writeFile(filePath, '<svg xmlns="http://www.w3.org/2000/svg"/>')
  try {
    const source = await prepareUploadSource({ filePath }, [], 1000, getDefaultManagedUploadRoot())
    assert.equal(source.contentType, 'image/svg+xml')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects files owned by another user', { skip: process.platform === 'win32' || typeof process.getuid !== 'function' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-owner-test-'))
  const original = process.getuid
  try {
    const filePath = join(directory, 'file.txt')
    await writeFile(filePath, 'hello')
    process.getuid = () => original.call(process) + 1
    await assert.rejects(
      prepareUploadSource({ filePath }, [], 100, getDefaultManagedUploadRoot()),
      /owned by the current user/
    )
  } finally {
    process.getuid = original
    await rm(directory, { recursive: true, force: true })
  }
})

test('upload-root parsing follows POSIX and Windows conventions', () => {
  assert.deepEqual(parseUploadRoots('/tmp/a:/tmp/b', 'linux'), ['/tmp/a', '/tmp/b'])
  assert.deepEqual(parseUploadRoots('C:\\one;D:\\two', 'win32'), ['C:\\one', 'D:\\two'])
})

test('upload sources require exactly one source field', async () => {
  await assert.rejects(
    prepareUploadSource({ filePath: '/tmp/a', sourceUrl: 'https://example.com/a' }, ['/tmp'], 100),
    /exactly one/
  )
})

test('URL upload sources reject private network destinations', async () => {
  await assert.rejects(
    prepareUploadSource({ sourceUrl: 'https://127.0.0.1/private.txt' }, [], 100),
    /private or reserved/
  )
})

const lookupOnce = (hostname, options, resolver) =>
  new Promise((resolve) =>
    createValidatingLookup(resolver)(hostname, options, (error, address, family) =>
      resolve({ error, address, family })
    )
  )

test('connect-time lookup rejects a private address returned after pre-validation passed', async () => {
  // Simulates DNS rebinding: first answer is public, later answers are private.
  const answers = [[{ address: '93.184.216.34', family: 4 }], [{ address: '169.254.169.254', family: 4 }]]
  const resolver = async () => answers.shift()
  const first = await lookupOnce('rebind.example', {}, resolver)
  assert.equal(first.error, null)
  assert.equal(first.address, '93.184.216.34')
  const second = await lookupOnce('rebind.example', { all: true }, resolver)
  assert.match(second.error.message, /private or reserved/)
})

test('connect-time lookup checks every address and supports all-address mode', async () => {
  const mixed = async () => [
    { address: '93.184.216.34', family: 4 },
    { address: '10.0.0.5', family: 4 },
  ]
  assert.match((await lookupOnce('mixed.example', { all: true }, mixed)).error.message, /private/)
  const pub = async () => [{ address: '93.184.216.34', family: 4 }]
  const result = await lookupOnce('ok.example', { all: true }, pub)
  assert.deepEqual(result.address, [{ address: '93.184.216.34', family: 4 }])
  const failing = async () => {
    throw new Error('ENOTFOUND')
  }
  assert.match((await lookupOnce('x.example', {}, failing)).error.message, /ENOTFOUND/)
  for (const address of ['::1', 'fd00::1', '100.64.0.1', '192.168.1.1', '::ffff:127.0.0.1']) {
    const blocked = await lookupOnce('v.example', {}, async () => [{ address, family: 4 }])
    assert.ok(blocked.error, address)
  }
})

test('URL fetch connects only through the validating lookup and rejects private resolution', async () => {
  const resolver = async () => [{ address: '127.0.0.1', family: 4 }]
  await assert.rejects(
    fetchWithSafeRedirects('https://rebind.example/file.txt', resolver),
    /private or reserved/
  )
  await assert.rejects(fetchWithSafeRedirects('http://example.com/a'), /Only HTTPS/)
  await assert.rejects(fetchWithSafeRedirects('https://u:p@example.com/a'), /credentials/)
  await assert.rejects(fetchWithSafeRedirects('https://[::1]/a'), /private or reserved/)
})

