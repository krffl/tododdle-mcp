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

  assert.equal(result.tools.length, 36)
  assert.equal(names.includes('delete_task'), false)
  assert.equal(names.includes('archive_task'), true)
  assert.equal(names.includes('get_project_brief'), true)
  assert.equal(names.includes('get_active_time_entries'), true)
  assert.equal(names.includes('get_focus_list'), true)
  assert.equal(names.includes('add_task_to_focus'), true)
  assert.equal(names.includes('move_focus_task'), true)
  assert.equal(names.includes('remove_task_from_focus'), true)
  assert.equal(names.includes('preview_task_move'), true)
  assert.equal(result.tools.find(tool => tool.name === 'move_task')?.annotations?.destructiveHint, true)
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

test('serializes Focus tools to the bounded external API', async () => {
  const calls = []
  const focusApi = {
    ...api,
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { items: [] } },
    post: async (path, body, idempotencyKey) => { calls.push({ method: 'POST', path, body, idempotencyKey }); return { entity: {} } },
    patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return { entity: {} } },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(focusApi)
  const client = new Client({ name: 'focus-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({ name: 'get_focus_list', arguments: { bucket: 'TODAY', page: 2, limit: 20 } })
    await client.callTool({ name: 'add_task_to_focus', arguments: { taskId: 'task-1', bucket: 'NEXT', idempotencyKey: 'focus-key-1' } })
    await client.callTool({ name: 'move_focus_task', arguments: { taskId: 'task-1', bucket: 'LATER', position: 3, expectedUpdatedAt: '2026-07-28T12:00:00.000Z' } })
    await client.callTool({ name: 'remove_task_from_focus', arguments: { taskId: 'task-1' } })

    assert.deepEqual(calls, [
      { method: 'GET', path: '/api/external/focus', query: { bucket: 'TODAY', page: 2, limit: 20 } },
      { method: 'POST', path: '/api/external/focus', body: { taskId: 'task-1', bucket: 'NEXT' }, idempotencyKey: 'focus-key-1' },
      { method: 'PATCH', path: '/api/external/focus/task-1', body: { bucket: 'LATER', position: 3, expectedUpdatedAt: '2026-07-28T12:00:00.000Z' } },
      { method: 'DELETE', path: '/api/external/focus/task-1', body: {} },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('previews and executes cross-plan task moves', async () => {
  const calls = []
  const moveApi = {
    ...api,
    post: async (path, body) => { calls.push({ method: 'POST', path, body }); return { entity: { canMove: true } } },
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return { entity: { id: 'task-1' } } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(moveApi)
  const client = new Client({ name: 'move-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const expectedUpdatedAt = '2026-07-29T12:00:00.000Z'
    await client.callTool({
      name: 'preview_task_move',
      arguments: { taskId: 'task-1', planId: 'plan-2', sectionId: 'section-2', expectedUpdatedAt },
    })
    await client.callTool({
      name: 'move_task',
      arguments: { taskId: 'task-1', planId: 'plan-2', sectionId: 'section-2', position: 0, expectedUpdatedAt },
    })

    assert.deepEqual(calls, [
      {
        method: 'POST',
        path: '/api/external/tasks/task-1/move/preview',
        body: { planId: 'plan-2', sectionId: 'section-2', expectedUpdatedAt },
      },
      {
        method: 'PUT',
        path: '/api/external/tasks/task-1/move',
        body: { planId: 'plan-2', sectionId: 'section-2', position: 0, expectedUpdatedAt },
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
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
