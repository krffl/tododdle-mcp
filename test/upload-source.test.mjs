import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { prepareUploadSource } from '../dist/upload-source.js'

test('local upload sources require an allowed root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-source-test-'))
  const filePath = join(directory, 'file.txt')
  await writeFile(filePath, 'hello')
  try {
    await assert.rejects(
      prepareUploadSource({ filePath }, [], 100),
      /TODODDLE_UPLOAD_ROOTS/
    )
    const source = await prepareUploadSource({ filePath }, [directory], 100)
    assert.equal(source.fileName, 'file.txt')
    assert.equal(source.fileSize, 5)
    assert.equal(source.contentType, 'text/plain')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
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
