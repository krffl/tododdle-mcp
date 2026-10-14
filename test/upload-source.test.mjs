import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getDefaultManagedUploadRoot, parseUploadRoots } from '../dist/config.js'
import {
  createValidatingLookup,
  ensureManagedUploadRoot,
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

test('managed staging is private, zero-config, and cleans up only after confirmed success', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'tododdle-managed-test-'))
  const managedRoot = join(temporaryDirectory, 'tododdle-mcp-uploads')
  const stagingDirectory = join(managedRoot, 'operation-1')
  const filePath = join(stagingDirectory, 'file.txt')
  try {
    await ensureManagedUploadRoot(managedRoot)
    await mkdir(stagingDirectory, { mode: 0o700 })
    await writeFile(filePath, 'hello', { mode: 0o600 })
    if (process.platform !== 'win32') {
      assert.equal((await stat(managedRoot)).mode & 0o777, 0o700)
    }

    const retained = await prepareUploadSource({ filePath }, [], 100, managedRoot)
    await retained.cleanup(false)
    assert.equal(await readFile(filePath, 'utf8'), 'hello')

    const confirmed = await prepareUploadSource({ filePath }, [], 100, managedRoot)
    await confirmed.cleanup(true)
    await assert.rejects(lstat(filePath), { code: 'ENOENT' })
    await assert.rejects(lstat(stagingDirectory), { code: 'ENOENT' })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test('managed staging rejects symlink escapes', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-symlink-test-'))
  const managedRoot = join(directory, 'managed')
  const outsideFile = join(directory, 'outside.txt')
  const linkedFile = join(managedRoot, 'linked.txt')
  try {
    await ensureManagedUploadRoot(managedRoot)
    await writeFile(outsideFile, 'private')
    await symlink(outsideFile, linkedFile)
    await assert.rejects(
      prepareUploadSource({ filePath: linkedFile }, [], 100, managedRoot),
      /outside ToDoddle managed staging/
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('upload-root parsing and managed paths follow POSIX and Windows conventions', () => {
  assert.deepEqual(parseUploadRoots('/tmp/a:/tmp/b', 'linux'), ['/tmp/a', '/tmp/b'])
  assert.deepEqual(parseUploadRoots('C:\\one;D:\\two', 'win32'), ['C:\\one', 'D:\\two'])
  assert.equal(getDefaultManagedUploadRoot('/tmp', 'linux'), '/tmp/tododdle-mcp-uploads')
  assert.equal(
    getDefaultManagedUploadRoot('C:\\Temp', 'win32'),
    'C:\\Temp\\tododdle-mcp-uploads'
  )
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
