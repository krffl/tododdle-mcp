import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { loadMcpConfig } from '../dist/config.js'
import { ToDoddleApiClient } from '../dist/api-client.js'
import { createToDoddleMcpServer } from '../dist/server.js'

const parity = JSON.parse(
  await readFile(new URL('../config/external-api-parity.json', import.meta.url), 'utf8')
)

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
  const listTasksTool = result.tools.find(tool => tool.name === 'list_tasks')
  const documentDownloadTool = result.tools.find(tool => tool.name === 'get_document_download_url')
  const uploadDocumentTool = result.tools.find(tool => tool.name === 'upload_project_document')
  const attachFileTool = result.tools.find(tool => tool.name === 'attach_file_to_task')
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(client.getServerVersion()?.version, packageJson.version)
  assert.equal(result.tools.length, Object.keys(parity.tools).length)
  assert.equal(names.includes('delete_task'), false)
  assert.equal(names.includes('archive_task'), true)
  assert.equal(names.includes('get_project_brief'), true)
  assert.equal(names.includes('get_active_time_entries'), true)
  assert.equal(names.includes('get_focus_list'), true)
  assert.equal(names.includes('list_tasks'), true)
  assert.equal(names.includes('claim_task'), true)
  assert.equal(names.includes('release_task'), true)
  assert.equal(names.includes('add_task_to_focus'), true)
  assert.equal(names.includes('move_focus_task'), true)
  assert.equal(names.includes('remove_task_from_focus'), true)
  assert.equal(names.includes('preview_task_move'), true)
  for (const name of [
    'get_project', 'create_project', 'update_project', 'archive_project', 'restore_project',
    'list_plans', 'get_plan', 'create_plan', 'update_plan', 'move_plan', 'archive_plan', 'restore_plan',
    'list_sections', 'get_section', 'create_section', 'update_section', 'move_section', 'archive_section', 'restore_section',
    'list_project_members', 'list_project_documents', 'get_document_download_url', 'list_notes', 'get_note', 'create_note', 'update_note',
    'archive_note', 'list_artifact_revisions', 'link_project_artifacts',
  ]) assert.equal(names.includes(name), true, `${name} should be discoverable`)
  assert.equal(result.tools.find(tool => tool.name === 'move_task')?.annotations?.destructiveHint, true)
  assert.equal(result.tools.find(tool => tool.name === 'archive_project')?.annotations?.destructiveHint, true)
  assert.equal(result.tools.find(tool => tool.name === 'restore_project')?.annotations?.destructiveHint, false)
  assert.equal(result.tools.find(tool => tool.name === 'create_section')?.annotations?.idempotentHint, false)
  assert.equal(result.tools.find(tool => tool.name === 'remove_task_from_focus')?.annotations?.destructiveHint, true)
  assert.deepEqual(
    listTasksTool?.annotations,
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  )
  assert.deepEqual(
    documentDownloadTool?.annotations,
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  )
  assert.deepEqual(Object.keys(documentDownloadTool?.inputSchema.properties || {}), [
    'projectId',
    'documentId',
  ])
  assert.equal(listTasksTool?.inputSchema.properties?.includeArchived?.default, false)
  assert.equal(listTasksTool?.inputSchema.properties?.page?.default, 1)
  assert.equal(listTasksTool?.inputSchema.properties?.limit?.default, 50)
  assert.equal(listTasksTool?.inputSchema.properties?.limit?.maximum, 100)
  assert.deepEqual(Object.keys(uploadDocumentTool?.inputSchema.properties || {}), [
    'projectId', 'filePath', 'sourceUrl', 'fileName', 'contentType', 'description', 'folderId',
    'idempotencyKey',
  ])
  assert.deepEqual(Object.keys(attachFileTool?.inputSchema.properties || {}), [
    'projectId', 'filePath', 'sourceUrl', 'fileName', 'contentType', 'description', 'folderId',
    'idempotencyKey', 'taskId',
  ])
  assert.match(result.tools.find(tool => tool.name === 'start_task_timer')?.description || '', /one active timer/)
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
      baseUrl: 'https://www.tododdle.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      uploadRoots: [],
      maxUploadBytes: 1073741824,
    }
  )

  assert.throws(() => loadMcpConfig({}), /TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET/)
  assert.equal(loadMcpConfig({
    TODODDLE_BASE_URL: 'http://localhost:3000',
    TODODDLE_CLIENT_ID: 'client-id',
    TODODDLE_CLIENT_SECRET: 'client-secret',
  }).baseUrl, 'http://localhost:3000')
  assert.throws(() => loadMcpConfig({
    TODODDLE_BASE_URL: 'http://tododdle.example',
    TODODDLE_CLIENT_ID: 'client-id',
    TODODDLE_CLIENT_SECRET: 'client-secret',
  }), /must use HTTPS/)
  assert.throws(() => loadMcpConfig({
    TODODDLE_BASE_URL: 'https://tododdle.example/api?token=nope',
    TODODDLE_CLIENT_ID: 'client-id',
    TODODDLE_CLIENT_SECRET: 'client-secret',
  }), /must be an origin/)
  assert.throws(() => loadMcpConfig({
    TODODDLE_BASE_URL: 'https://trackingti.me',
    TODODDLE_CLIENT_ID: 'client-id',
    TODODDLE_CLIENT_SECRET: 'client-secret',
  }), /has moved.*www\.tododdle\.com/)
})

test('uses the configured base URL for tokens and API requests', async () => {
  const originalFetch = globalThis.fetch
  const urls = []
  globalThis.fetch = async (input) => {
    urls.push(String(input))
    if (String(input).endsWith('/api/external/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const client = new ToDoddleApiClient({
      baseUrl: 'http://localhost:3000',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      uploadRoots: [],
      maxUploadBytes: 1024,
    })
    await client.get('/api/external/projects', { page: 2 })
    assert.deepEqual(urls, [
      'http://localhost:3000/api/external/oauth/token',
      'http://localhost:3000/api/external/projects?page=2',
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports base URL redirects as configuration errors before credentials are dropped', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(null, {
    status: 307,
    headers: { location: 'https://www.tododdle.com/api/external/oauth/token' },
  })

  try {
    const client = new ToDoddleApiClient({
      baseUrl: 'https://legacy.example',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      uploadRoots: [],
      maxUploadBytes: 1024,
    })
    await assert.rejects(
      () => client.get('/api/external/projects'),
      error => error?.code === 'configuration_error' && /configure the final API origin/.test(error.message),
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('serializes project, plan, section, Note, and supporting tools', async () => {
  const calls = []
  const managementApi = {
    ...api,
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { items: [] } },
    post: async (path, body, idempotencyKey) => { calls.push({ method: 'POST', path, body, idempotencyKey }); return { entity: {} } },
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return { entity: {} } },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(managementApi)
  const client = new Client({ name: 'management-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const expectedUpdatedAt = '2026-07-29T12:00:00.000Z'
    await client.callTool({ name: 'create_plan', arguments: { projectId: 'project-1', name: 'Delivery', idempotencyKey: 'plan-key-1' } })
    await client.callTool({ name: 'create_section', arguments: { projectId: 'project-1', planId: 'plan-1', name: 'Review', entryActions: [{ type: 'SET_STATUS', status: 'REVIEW' }, { type: 'SET_KIND', kind: 'FEATURE' }], idempotencyKey: 'section-key-1' } })
    await client.callTool({ name: 'create_task', arguments: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', title: 'Feature work', kind: 'FEATURE', idempotencyKey: 'task-key-1' } })
    await client.callTool({ name: 'move_section', arguments: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', position: 0, expectedUpdatedAt } })
    await client.callTool({ name: 'list_project_members', arguments: { projectId: 'project-1', page: 1, limit: 20 } })
    await client.callTool({ name: 'archive_note', arguments: { noteId: 'note-1', expectedUpdatedAt } })
    await client.callTool({ name: 'list_artifact_revisions', arguments: { projectId: 'project-1', artifactId: 'artifact-1' } })

    assert.deepEqual(calls, [
      { method: 'POST', path: '/api/external/projects/project-1/plans', body: { name: 'Delivery' }, idempotencyKey: 'plan-key-1' },
      { method: 'POST', path: '/api/external/projects/project-1/plans/plan-1/sections', body: { name: 'Review', entryActions: [{ type: 'SET_STATUS', status: 'REVIEW' }, { type: 'SET_KIND', kind: 'FEATURE' }] }, idempotencyKey: 'section-key-1' },
      { method: 'POST', path: '/api/external/tasks', body: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', title: 'Feature work', kind: 'FEATURE' }, idempotencyKey: 'task-key-1' },
      { method: 'PUT', path: '/api/external/projects/project-1/plans/plan-1/sections/section-1', body: { position: 0, expectedUpdatedAt } },
      { method: 'GET', path: '/api/external/projects/project-1/members', query: { page: 1, limit: 20 } },
      { method: 'DELETE', path: '/api/external/notes/note-1', body: { expectedUpdatedAt } },
      { method: 'GET', path: '/api/external/projects/project-1/artifacts/artifact-1/revisions', query: undefined },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('lists tasks with bounded hierarchy and task filters', async () => {
  const calls = []
  const taskApi = {
    ...api,
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { tasks: [], pagination: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(taskApi)
  const client = new Client({ name: 'task-list-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'list_tasks',
      arguments: {
        projectId: 'project-1',
        planId: 'plan-1',
        sectionId: 'section-1',
        assigneeId: 'user-1',
        status: 'COMPLETE',
        priority: 'HIGH',
        search: 'release',
        includeArchived: true,
        page: 2,
        limit: 25,
      },
    })
    await client.callTool({ name: 'list_tasks', arguments: {} })

    assert.deepEqual(calls, [
      {
        method: 'GET',
        path: '/api/external/tasks',
        query: {
          projectId: 'project-1',
          planId: 'plan-1',
          sectionId: 'section-1',
          assigneeId: 'user-1',
          status: 'COMPLETE',
          priority: 'HIGH',
          search: 'release',
          includeArchived: true,
          page: 2,
          limit: 25,
        },
      },
      {
        method: 'GET',
        path: '/api/external/tasks',
        query: { includeArchived: false, page: 1, limit: 50 },
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('requests a tokenized document URL with parent-to-child identifiers', async () => {
  const calls = []
  const documentApi = {
    ...api,
    post: async (path, body) => {
      calls.push({ method: 'POST', path, body })
      return {
        document: { id: 'document-1', fileName: 'evidence.pdf' },
        accessType: 'download',
        url: 'https://private.example/evidence.pdf?token=signed',
        expiresIn: 300,
      }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(documentApi)
  const client = new Client({ name: 'document-download-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const result = await client.callTool({
      name: 'get_document_download_url',
      arguments: { projectId: 'project-1', documentId: 'document-1' },
    })

    assert.equal(result.isError, undefined)
    assert.deepEqual(calls, [{
      method: 'POST',
      path: '/api/external/projects/project-1/documents/document-1/download-url',
      body: {},
    }])
  } finally {
    await client.close()
    await server.close()
  }
})

test('serializes Agent Connection task claims and releases', async () => {
  const calls = []
  const claimApi = {
    ...api,
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return { entity: {} } },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(claimApi)
  const client = new Client({ name: 'task-claim-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'claim_task',
      arguments: { taskId: 'task-1', runId: 'run-1' },
    })
    await client.callTool({
      name: 'claim_task',
      arguments: { taskId: 'task-1', runId: 'run-1', state: 'WAITING', leaseSeconds: 300 },
    })
    await client.callTool({
      name: 'release_task',
      arguments: { taskId: 'task-1', runId: 'run-1' },
    })

    assert.deepEqual(calls, [
      {
        method: 'PUT',
        path: '/api/external/tasks/task-1/claim',
        body: { runId: 'run-1', state: 'ACTIVE', leaseSeconds: 900 },
      },
      {
        method: 'PUT',
        path: '/api/external/tasks/task-1/claim',
        body: { runId: 'run-1', state: 'WAITING', leaseSeconds: 300 },
      },
      {
        method: 'DELETE',
        path: '/api/external/tasks/task-1/claim',
        body: { runId: 'run-1' },
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
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
