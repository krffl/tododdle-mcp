import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { loadMcpConfig } from '../dist/config.js'
import { createToDoddleMcpServer } from '../dist/server.js'

const api = {
  get: async () => ({ items: [] }),
  post: async () => ({ entity: {} }),
  put: async () => ({ entity: {} }),
  patch: async () => ({ entity: {} }),
  delete: async () => ({ entity: {} }),
  uploadFile: async () => undefined,
}

test('discovers the bounded production tool surface', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(api)
  const client = new Client({ name: 'package-test', version: '1.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const result = await client.listTools()
  const resources = await client.listResourceTemplates()
  const names = result.tools.map(tool => tool.name)

  assert.equal(result.tools.length, 31)
  assert.equal(names.includes('delete_task'), false)
  assert.equal(names.includes('archive_task'), true)
  assert.equal(names.includes('get_project_brief'), true)
  assert.equal(names.includes('get_active_time_entries'), true)
  assert.deepEqual(
    result.tools.find(tool => tool.name === 'archive_time_entry')?.annotations,
    {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    }
  )
  assert.deepEqual(
    resources.resourceTemplates.map(resource => resource.uriTemplate),
    [
      'tododdle://tasks/{taskId}',
      'tododdle://projects/{projectId}',
      'tododdle://projects/{projectId}/artifacts/{artifactId}',
    ]
  )

  await client.close()
  await server.close()
})

test('requires only Agent Connection credentials', () => {
  assert.deepEqual(
    loadMcpConfig({
      TODODDLE_CLIENT_ID: 'client-id',
      TODODDLE_CLIENT_SECRET: 'client-secret',
    }),
    {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      uploadRoots: [],
      maxUploadBytes: 1073741824,
    }
  )

  assert.throws(() => loadMcpConfig({}), /TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET/)
})

test('uploads a local file and attaches it to a task through the hosted API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-mcp-test-'))
  const filePath = join(directory, 'evidence.txt')
  await writeFile(filePath, 'verified evidence')
  const calls = []
  const uploadApi = {
    get: async () => ({}),
    put: async () => ({}),
    patch: async () => ({}),
    delete: async () => ({}),
    post: async (path, body, idempotencyKey) => {
      calls.push({ path, body, idempotencyKey })
      if (path.endsWith('/upload-sessions')) {
        return {
          session: {
            documentId: 'document-1',
            uploadUrl: 'https://storage.example/upload',
            headers: { 'Content-Type': 'text/plain' },
          },
        }
      }
      return { entity: { document: { id: 'document-1' } }, requestId: 'request-1' }
    },
    uploadFile: async (url, headers, uploadedPath, fileSize) => {
      calls.push({ url, headers, uploadedPath, fileSize, content: await readFile(uploadedPath, 'utf8') })
    },
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(uploadApi, { uploadRoots: [directory] })
  const client = new Client({ name: 'upload-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const result = await client.callTool({
      name: 'attach_file_to_task',
      arguments: { projectId: 'project-1', taskId: 'task-1', filePath },
    })
    assert.equal(result.isError, undefined)
    assert.equal(calls[0].path, '/api/external/projects/project-1/documents/upload-sessions')
    assert.equal(calls[0].body.creationSource, 'TASK_ATTACHMENT')
    assert.equal(calls[1].content, 'verified evidence')
    assert.equal(calls[2].path, '/api/external/projects/project-1/documents/document-1/finalize')
    assert.deepEqual(calls[2].body, { success: true, taskId: 'task-1' })
  } finally {
    await client.close()
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})
