import assert from 'node:assert/strict'
import { lstat, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { getDefaultManagedUploadRoot } from '../dist/config.js'
import {
  createValidatingLookup,
  fetchWithSafeRedirects,
  isPrivateAddress,
  prepareUploadSource,
} from '../dist/upload-source.js'

test('local uploads need the managed temp root and ignore any other folder', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-source-test-'))
  const filePath = join(directory, 'file.txt')
  await writeFile(filePath, 'hello')
  try {
    await assert.rejects(prepareUploadSource({ filePath }, 100), /Local file uploads are not available here/)
    const source = await prepareUploadSource({ filePath }, 100, getDefaultManagedUploadRoot())
    assert.equal(source.fileName, 'file.txt')
    assert.equal(source.fileSize, 5)
    assert.equal(source.contentType, 'text/plain')
    await source.cleanup(false)
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

    const retained = await prepareUploadSource({ filePath }, 100, managedRoot)
    assert.equal(retained.filePath, await realpath(filePath))
    await retained.cleanup(false)
    assert.equal(await readFile(filePath, 'utf8'), 'hello')

    const confirmed = await prepareUploadSource({ filePath }, 100, managedRoot)
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
      prepareUploadSource({ filePath: link }, 100, getDefaultManagedUploadRoot()),
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
      prepareUploadSource({ filePath: directory }, 100, getDefaultManagedUploadRoot()),
      /regular file/
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('rejects files outside the system temporary directory', async () => {
  const outside = await mkdtemp(join(process.cwd(), '.tododdle-outside-test-'))
  const filePath = join(outside, 'file.txt')
  try {
    await writeFile(filePath, 'hello')
    const managedRoot = getDefaultManagedUploadRoot()
    await assert.rejects(
      prepareUploadSource({ filePath }, 100, managedRoot),
      error => error.message === `Local file must be inside the system temporary directory (${managedRoot}). Copy it there, then retry.`
    )
  } finally {
    await rm(outside, { recursive: true, force: true })
  }
})

test('explains a missing local file instead of a raw ENOENT', async () => {
  const managedRoot = getDefaultManagedUploadRoot()
  const filePath = join(tmpdir(), `tododdle-missing-${Date.now()}.png`)
  await assert.rejects(
    prepareUploadSource({ filePath }, 100, managedRoot),
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
    const source = await prepareUploadSource({ filePath }, 1000, getDefaultManagedUploadRoot())
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
      prepareUploadSource({ filePath }, 100, getDefaultManagedUploadRoot()),
      /owned by the current user/
    )
  } finally {
    process.getuid = original
    await rm(directory, { recursive: true, force: true })
  }
})

test('upload sources require exactly one source field', async () => {
  await assert.rejects(
    prepareUploadSource({ filePath: '/tmp/a', sourceUrl: 'https://example.com/a' }, 100),
    /exactly one/
  )
})

test('URL upload sources reject private network destinations', async () => {
  await assert.rejects(
    prepareUploadSource({ sourceUrl: 'https://127.0.0.1/private.txt' }, 100),
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


const privateAddressCases = [
  ['0.0.0.0/8', ['0.0.0.0', '0.255.255.255']],
  ['10.0.0.0/8', ['10.0.0.1', '10.255.255.255']],
  ['100.64.0.0/10', ['100.64.0.1', '100.127.255.254']],
  ['127.0.0.0/8', ['127.0.0.1', '127.255.255.255']],
  ['169.254.0.0/16', ['169.254.169.254']],
  ['172.16.0.0/12', ['172.16.0.1', '172.31.255.255']],
  ['192.0.0.0/24', ['192.0.0.8', '192.0.0.255']],
  ['192.0.2.0/24', ['192.0.2.1']],
  ['192.168.0.0/16', ['192.168.1.1']],
  ['198.18.0.0/15', ['198.18.0.1', '198.19.255.255']],
  ['198.51.100.0/24 and 203.0.113.0/24', ['198.51.100.7', '203.0.113.9']],
  ['224.0.0.0/4', ['224.0.0.1', '239.255.255.250']],
  ['240.0.0.0/4', ['240.0.0.1', '250.1.2.3']],
  ['255.255.255.255', ['255.255.255.255']],
  ['IPv6 unspecified and loopback', ['::', '::1', '[::1]', '0:0:0:0:0:0:0:1']],
  ['IPv4-mapped', ['::ffff:127.0.0.1', '::ffff:7f00:1', '[::ffff:7f00:1]', '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:c0a8:101']],
  ['IPv4-compatible', ['::7f00:1', '::127.0.0.1', '::808:808']],
  ['NAT64 64:ff9b::/96', ['64:ff9b::7f00:1', '64:ff9b::10.0.0.1', '64:ff9b::a9fe:a9fe']],
  ['local NAT64 64:ff9b:1::/48', ['64:ff9b:1::808:808']],
  ['6to4 2002::/16', ['2002:7f00:1::', '2002:a00:1::1', '2002:c0a8:101::1']],
  ['Teredo and documentation', ['2001::1', '2001:db8::1']],
  ['unique local fc00::/7', ['fc00::1', 'fd12:3456::1']],
  ['link-local fe80::/10', ['fe80::1', 'fe9a::1', 'febf:ffff::1', 'fe80::1%en0']],
  ['site-local fec0::/10', ['fec0::1', 'feff::1']],
  ['multicast ff00::/8', ['ff02::1']],
  ['not an IP literal', ['', 'localhost', 'example.com', '1.2.3', '::ffff:999.0.0.1', '1::2::3']],
]

for (const [range, addresses] of privateAddressCases) {
  test(`private address check blocks ${range}`, () => {
    for (const address of addresses) assert.equal(isPrivateAddress(address), true, address)
  })
}

test('private address check allows public unicast addresses', () => {
  for (const address of [
    '1.1.1.1', '8.8.8.8', '93.184.216.34', '100.63.255.255', '100.128.0.0', '172.15.255.255',
    '172.32.0.0', '192.0.1.1', '198.17.255.255', '198.20.0.0', '223.255.255.255',
    '2606:4700:4700::1111', '2a00:1450:4009:81f::200e', '::ffff:8.8.8.8', '::ffff:808:808',
    '64:ff9b::808:808', '2002:808:808::1', 'fe7f::1', 'fbff::1',
  ]) {
    assert.equal(isPrivateAddress(address), false, address)
  }
})
