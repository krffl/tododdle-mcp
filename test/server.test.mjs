import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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
  const listTicketsTool = result.tools.find(tool => tool.name === 'list_tickets')
  const searchProjectTool = result.tools.find(tool => tool.name === 'search_project')
  const getTicketsTool = result.tools.find(tool => tool.name === 'get_tickets')
  const getProjectContextTool = result.tools.find(tool => tool.name === 'get_project_context')
  const listProjectArtifactsTool = result.tools.find(tool => tool.name === 'list_project_artifacts')
  const createProjectArtifactTool = result.tools.find(tool => tool.name === 'create_project_artifact')
  const updateProjectArtifactTool = result.tools.find(tool => tool.name === 'update_project_artifact')
  const createLaneTool = result.tools.find(tool => tool.name === 'create_lane')
  const documentDownloadTool = result.tools.find(tool => tool.name === 'get_document_download_url')
  const uploadDocumentTool = result.tools.find(tool => tool.name === 'upload_project_document')
  const attachFileTool = result.tools.find(tool => tool.name === 'attach_file_to_ticket')
  const beginUploadTool = result.tools.find(tool => tool.name === 'begin_upload')
  const completeUploadTool = result.tools.find(tool => tool.name === 'complete_upload')
  const getNoteTool = result.tools.find(tool => tool.name === 'get_note')
  const listReviewsTool = result.tools.find(tool => tool.name === 'list_review_requests')
  const createReviewTool = result.tools.find(tool => tool.name === 'create_review_request')
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

  assert.equal(client.getServerVersion()?.version, packageJson.version)
  assert.equal(result.tools.length, Object.keys(parity.tools).length)
  assert.equal(names.includes('delete_task'), false)
  assert.equal(names.includes('archive_task'), false)
  assert.equal(names.includes('list_tasks'), false)
  assert.equal(names.includes('archive_ticket'), true)
  assert.equal(names.includes('get_project_brief'), true)
  assert.match(getProjectContextTool?.description || '', /brief summary.*artifact summaries/)
  assert.match(listProjectArtifactsTool?.description || '', /summary-only/)
  assert.match(JSON.stringify(createProjectArtifactTool?.inputSchema.properties?.summary), /"maxLength":500/)
  assert.match(JSON.stringify(updateProjectArtifactTool?.inputSchema.properties?.summary), /"maxLength":500/)
  assert.equal(names.includes('get_active_time_entries'), true)
  assert.equal(names.includes('get_focus_list'), true)
  assert.equal(names.includes('list_tickets'), true)
  assert.equal(names.includes('search_project'), true)
  assert.match(searchProjectTool?.description || '', /discovery.*instead of scanning/)
  assert.deepEqual(listTicketsTool?.inputSchema.properties?.detail?.default, 'summary')
  assert.equal(names.includes('get_tickets'), true)
  assert.equal(names.includes('get_support_case'), true)
  assert.equal(names.includes('update_support_case'), true)
  assert.equal(names.includes('reply_to_support_case'), true)
  assert.equal(names.includes('begin_upload'), true)
  assert.equal(names.includes('complete_upload'), true)
  assert.equal(names.includes('list_ticket_attributes'), true)
  assert.equal(names.includes('set_ticket_attribute'), true)
  assert.equal(names.includes('delete_ticket_attribute'), true)
  assert.equal(names.includes('claim_ticket'), true)
  assert.equal(names.includes('claim_next_ticket'), true)
  assert.equal(names.includes('renew_ticket_claim'), true)
  assert.equal(names.includes('list_available_work'), true)
  assert.equal(names.includes('release_ticket'), true)
  assert.equal(names.includes('add_ticket_to_focus'), true)
  assert.equal(names.includes('move_focus_ticket'), true)
  assert.equal(names.includes('remove_ticket_from_focus'), true)
  assert.equal(names.includes('preview_ticket_move'), true)
  for (const name of [
    'get_project', 'create_project', 'update_project', 'archive_project', 'restore_project',
    'list_boards', 'get_board', 'create_board', 'update_board', 'move_board', 'archive_board', 'restore_board',
    'list_lanes', 'get_lane', 'create_lane', 'update_lane', 'move_lane', 'archive_lane', 'restore_lane',
    'list_project_members', 'list_review_requests', 'get_review_request', 'create_review_request', 'update_review_request', 'respond_to_review_request', 'list_review_comments', 'add_review_comment', 'add_review_checklist_item', 'update_review_checklist_item', 'complete_review_request', 'cancel_review_request',
    'list_project_documents', 'get_document_download_url', 'list_notes', 'get_note', 'create_note', 'update_note',
    'archive_note', 'list_artifact_revisions', 'link_project_artifacts',
  ]) assert.equal(names.includes(name), true, `${name} should be discoverable`)
  assert.equal(result.tools.find(tool => tool.name === 'move_ticket')?.annotations?.destructiveHint, true)
  assert.equal(result.tools.find(tool => tool.name === 'archive_project')?.annotations?.destructiveHint, true)
  assert.equal(result.tools.find(tool => tool.name === 'restore_project')?.annotations?.destructiveHint, false)
  assert.equal(result.tools.find(tool => tool.name === 'create_lane')?.annotations?.idempotentHint, false)
  assert.equal(result.tools.find(tool => tool.name === 'remove_ticket_from_focus')?.annotations?.destructiveHint, true)
  assert.deepEqual(
    beginUploadTool?.annotations,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    }
  )
  assert.deepEqual(
    completeUploadTool?.annotations,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  )
  assert.deepEqual(
    listTicketsTool?.annotations,
    {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    }
  )
  assert.deepEqual(getTicketsTool?.annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  })
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
  assert.deepEqual(Object.keys(getNoteTool?.inputSchema.properties || {}), [
    'projectId',
    'noteId',
  ])
  assert.equal(listTicketsTool?.inputSchema.properties?.includeArchived?.default, false)
  assert.equal(listTicketsTool?.inputSchema.properties?.page?.default, 1)
  assert.equal(listTicketsTool?.inputSchema.properties?.limit?.default, 50)
  assert.equal(listTicketsTool?.inputSchema.properties?.limit?.maximum, 100)
  assert.equal(createLaneTool?.inputSchema.properties?.entryActions?.maxItems, 6)
  assert.match(JSON.stringify(createLaneTool?.inputSchema.properties?.entryActions), /REQUEST_REVIEW/)
  assert.equal(listReviewsTool?.inputSchema.properties?.limit?.maximum, 50)
  assert.match(createReviewTool?.description || '', /do not change ticket status/)
  assert.deepEqual(Object.keys(uploadDocumentTool?.inputSchema.properties || {}), [
    'projectId', 'filePath', 'sourceUrl', 'fileName', 'contentType', 'description', 'folderId',
    'idempotencyKey',
  ])
  assert.deepEqual(Object.keys(attachFileTool?.inputSchema.properties || {}), [
    'projectId', 'filePath', 'sourceUrl', 'fileName', 'contentType', 'description', 'folderId',
    'idempotencyKey', 'taskId',
  ])
  assert.match(result.tools.find(tool => tool.name === 'start_ticket_timer')?.description || '', /one active timer/)
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
      'tododdle://tickets/{ticketId}',
      'tododdle://projects/{projectId}',
      'tododdle://projects/{projectId}/artifacts/{artifactId}',
    ]
  )

  await client.close()
  await server.close()
})

test('requires only Agent Connection credentials', () => {
  const config = loadMcpConfig({
      TODODDLE_CLIENT_ID: 'client-id',
      TODODDLE_CLIENT_SECRET: 'client-secret',
    })
  assert.equal(config.baseUrl, 'https://app.tododdle.com')
  assert.equal(config.clientId, 'client-id')
  assert.equal(config.clientSecret, 'client-secret')
  assert.deepEqual(config.uploadRoots, [])
  assert.equal(config.managedUploadRoot, join(tmpdir(), 'tododdle-mcp-uploads'))
  assert.equal(config.maxUploadBytes, 1073741824)

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
  }), /application origin.*app\.tododdle\.com/)
  assert.throws(() => loadMcpConfig({
    TODODDLE_BASE_URL: 'https://www.tododdle.com',
    TODODDLE_CLIENT_ID: 'client-id',
    TODODDLE_CLIENT_SECRET: 'client-secret',
  }), /application origin.*app\.tododdle\.com/)
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
    await client.callTool({ name: 'create_board', arguments: { projectId: 'project-1', name: 'Delivery', idempotencyKey: 'plan-key-1' } })
    await client.callTool({ name: 'create_lane', arguments: { projectId: 'project-1', planId: 'plan-1', name: 'Review', entryActions: [{ type: 'SET_STATUS', status: 'REVIEW' }, { type: 'SET_KIND', kind: 'FEATURE' }, { type: 'REQUEST_REVIEW', reviewerIds: ['user-2', 'user-3'], instructions: 'Check the release.' }], idempotencyKey: 'section-key-1' } })
    await client.callTool({ name: 'update_lane', arguments: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', expectedUpdatedAt, entryActions: [{ type: 'REQUEST_REVIEW', reviewerIds: ['user-2'] }] } })
    await client.callTool({ name: 'create_ticket', arguments: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', title: 'Feature work', kind: 'FEATURE', idempotencyKey: 'task-key-1' } })
    await client.callTool({ name: 'move_lane', arguments: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', position: 0, expectedUpdatedAt } })
    await client.callTool({ name: 'list_project_members', arguments: { projectId: 'project-1', page: 1, limit: 20 } })
    await client.callTool({ name: 'list_notes', arguments: { projectId: 'project-1', parentId: 'note-parent', page: 2, limit: 10 } })
    await client.callTool({ name: 'get_note', arguments: { projectId: 'project-1', noteId: 'note-1' } })
    await client.callTool({ name: 'create_note', arguments: { projectId: 'project-1', title: 'Runbook', content: 'Project steps.', idempotencyKey: 'note-key-1' } })
    await client.callTool({ name: 'update_note', arguments: { projectId: 'project-1', noteId: 'note-1', expectedUpdatedAt, title: 'Updated runbook' } })
    await client.callTool({ name: 'archive_note', arguments: { projectId: 'project-1', noteId: 'note-1', expectedUpdatedAt } })
    await client.callTool({ name: 'list_artifact_revisions', arguments: { projectId: 'project-1', artifactId: 'artifact-1' } })

    assert.deepEqual(calls, [
      { method: 'POST', path: '/api/external/projects/project-1/plans', body: { name: 'Delivery' }, idempotencyKey: 'plan-key-1' },
      { method: 'POST', path: '/api/external/projects/project-1/plans/plan-1/sections', body: { name: 'Review', entryActions: [{ type: 'SET_STATUS', status: 'REVIEW' }, { type: 'SET_KIND', kind: 'FEATURE' }, { type: 'REQUEST_REVIEW', reviewerIds: ['user-2', 'user-3'], instructions: 'Check the release.' }] }, idempotencyKey: 'section-key-1' },
      { method: 'PUT', path: '/api/external/projects/project-1/plans/plan-1/sections/section-1', body: { expectedUpdatedAt, entryActions: [{ type: 'REQUEST_REVIEW', reviewerIds: ['user-2'] }] } },
      { method: 'POST', path: '/api/external/tasks', body: { projectId: 'project-1', planId: 'plan-1', sectionId: 'section-1', title: 'Feature work', kind: 'FEATURE' }, idempotencyKey: 'task-key-1' },
      { method: 'PUT', path: '/api/external/projects/project-1/plans/plan-1/sections/section-1', body: { position: 0, expectedUpdatedAt } },
      { method: 'GET', path: '/api/external/projects/project-1/members', query: { page: 1, limit: 20 } },
      { method: 'GET', path: '/api/external/notes', query: { projectId: 'project-1', page: 2, limit: 10, parentId: 'note-parent' } },
      { method: 'GET', path: '/api/external/notes/note-1', query: { projectId: 'project-1' } },
      { method: 'POST', path: '/api/external/notes', body: { projectId: 'project-1', title: 'Runbook', content: 'Project steps.' }, idempotencyKey: 'note-key-1' },
      { method: 'PUT', path: '/api/external/notes/note-1', body: { projectId: 'project-1', expectedUpdatedAt, title: 'Updated runbook' } },
      { method: 'DELETE', path: '/api/external/notes/note-1', body: { projectId: 'project-1', expectedUpdatedAt } },
      { method: 'GET', path: '/api/external/projects/project-1/artifacts/artifact-1/revisions', query: undefined },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('rejects unsafe review-request lane actions before calling the API', async () => {
  let apiCalled = false
  const validationApi = {
    ...api,
    post: async () => {
      apiCalled = true
      return { entity: {} }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(validationApi)
  const client = new Client({ name: 'lane-review-validation-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const duplicateReviewers = await client.callTool({
      name: 'create_lane',
      arguments: {
        projectId: 'project-1',
        planId: 'plan-1',
        name: 'Review',
        entryActions: [{ type: 'REQUEST_REVIEW', reviewerIds: ['user-2', 'user-2'] }],
      },
    })
    const reviewAndArchive = await client.callTool({
      name: 'create_lane',
      arguments: {
        projectId: 'project-1',
        planId: 'plan-1',
        name: 'Review',
        entryActions: [
          { type: 'REQUEST_REVIEW', reviewerIds: ['user-2'] },
          { type: 'ARCHIVE_TASK' },
        ],
      },
    })

    assert.equal(duplicateReviewers.isError, true)
    assert.equal(reviewAndArchive.isError, true)
    assert.equal(apiCalled, false)
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
      name: 'list_tickets',
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
    await client.callTool({ name: 'list_tickets', arguments: {} })

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
          detail: 'summary',
        },
      },
      {
        method: 'GET',
        path: '/api/external/tasks',
        query: { includeArchived: false, page: 1, limit: 50, detail: 'summary' },
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('searches one project with compact resource filters', async () => {
  const calls = []
  const searchApi = {
    ...api,
    get: async (path, query) => {
      calls.push({ path, query })
      return { query: 'product hunt', results: [] }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(searchApi)
  const client = new Client({ name: 'project-search-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'search_project',
      arguments: {
        projectId: 'project-1',
        query: 'product hunt',
        types: ['TICKET', 'NOTE', 'CONTEXT'],
        limit: 12,
      },
    })

    assert.deepEqual(calls, [{
      path: '/api/external/projects/project-1/search',
      query: { query: 'product hunt', types: 'TICKET,NOTE,CONTEXT', limit: 12 },
    }])
  } finally {
    await client.close()
    await server.close()
  }
})

test('keeps compact text fallback alongside structured tool output', async () => {
  const value = { tasks: [{ id: 'task-1', title: 'Compact' }], pagination: { total: 1 } }
  const compactApi = { ...api, get: async () => value }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(compactApi)
  const client = new Client({ name: 'compact-output-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const result = await client.callTool({ name: 'list_tickets', arguments: {} })
    assert.deepEqual(result.structuredContent, value)
    assert.equal(result.content[0].text, JSON.stringify(value))
    assert.equal(result.content[0].text.includes('\n'), false)
  } finally {
    await client.close()
    await server.close()
  }
})

test('batch reads known tickets with bounded comment detail', async () => {
  const calls = []
  const taskApi = {
    ...api,
    post: async (path, body) => {
      calls.push({ path, body })
      return { tasks: body.taskIds.map(id => ({ id })) }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(taskApi)
  const client = new Client({ name: 'task-batch-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'get_tickets',
      arguments: { taskIds: ['task-2', 'task-1', 'task-2'], commentMode: 'latest_update' },
    })
    assert.deepEqual(calls, [{
      path: '/api/external/tasks/batch',
      body: { taskIds: ['task-2', 'task-1', 'task-2'], commentMode: 'latest_update' },
    }])

    const oversized = await client.callTool({
      name: 'get_tickets',
      arguments: { taskIds: Array.from({ length: 21 }, (_, index) => `task-${index}`) },
    })
    assert.equal(oversized.isError, true)
    assert.equal(calls.length, 1)
  } finally {
    await client.close()
    await server.close()
  }
})

test('reads and updates support cases through parent-to-child routes', async () => {
  const calls = []
  const supportApi = {
    ...api,
    get: async (path) => { calls.push({ method: 'GET', path }); return { supportCase: {} } },
    patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return { supportCase: {} } },
    post: async (path, body, idempotencyKey) => {
      calls.push({ method: 'POST', path, body, idempotencyKey })
      return { supportCase: {} }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(supportApi)
  const client = new Client({ name: 'support-case-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'get_support_case', arguments: { projectId: 'project-1', taskId: 'task-1' },
    })
    await client.callTool({
      name: 'update_support_case',
      arguments: { projectId: 'project-1', taskId: 'task-1', status: 'RESOLVED', expectedRevision: 2 },
    })
    await client.callTool({
      name: 'reply_to_support_case',
      arguments: {
        projectId: 'project-1', taskId: 'task-1', content: 'Please try again.',
        visibility: 'REQUESTER_VISIBLE', expectedRevision: 3, idempotencyKey: 'support-reply-key',
      },
    })
    assert.deepEqual(calls, [
      { method: 'GET', path: '/api/external/projects/project-1/tasks/task-1/support-case' },
      {
        method: 'PATCH', path: '/api/external/projects/project-1/tasks/task-1/support-case',
        body: { status: 'RESOLVED', expectedRevision: 2 },
      },
      {
        method: 'POST', path: '/api/external/projects/project-1/tasks/task-1/support-case/messages',
        body: {
          content: 'Please try again.', visibility: 'REQUESTER_VISIBLE', expectedRevision: 3,
          idempotencyKey: 'support-reply-key',
        },
        idempotencyKey: 'support-reply-key',
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('reads, sets, and deletes typed ticket attributes', async () => {
  const calls = []
  const attributeApi = {
    ...api,
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { attributes: [] } },
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return { entity: {} } },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(attributeApi)
  const client = new Client({ name: 'task-attribute-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const expectedUpdatedAt = '2026-08-13T12:00:00.000Z'

  try {
    await client.callTool({ name: 'list_ticket_attributes', arguments: { taskId: 'task-1' } })
    await client.callTool({ name: 'set_ticket_attribute', arguments: { taskId: 'task-1', key: 'source.branch', type: 'STRING', value: 'main', expectedUpdatedAt } })
    await client.callTool({ name: 'delete_ticket_attribute', arguments: { taskId: 'task-1', key: 'source.branch', expectedUpdatedAt } })
    assert.deepEqual(calls, [
      { method: 'GET', path: '/api/external/tasks/task-1/attributes', query: undefined },
      { method: 'PUT', path: '/api/external/tasks/task-1/attributes', body: { key: 'source.branch', type: 'STRING', value: 'main', expectedUpdatedAt } },
      { method: 'DELETE', path: '/api/external/tasks/task-1/attributes', body: { key: 'source.branch', expectedUpdatedAt } },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('uses parent-to-child review routes with bounded inputs and concurrency fields', async () => {
  const calls = []
  const reviewApi = {
    ...api,
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { reviews: [] } },
    post: async (path, body, idempotencyKey) => { calls.push({ method: 'POST', path, body, idempotencyKey }); return { review: {} } },
    patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return { review: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(reviewApi)
  const client = new Client({ name: 'review-request-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const expectedUpdatedAt = '2026-08-23T12:00:00.000Z'

  try {
    await client.callTool({
      name: 'list_review_requests',
      arguments: { projectId: 'project-1', targetType: 'TASK', state: 'OPEN', page: 1, limit: 20 },
    })
    await client.callTool({
      name: 'get_review_request',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1' },
    })
    await client.callTool({
      name: 'create_review_request',
      arguments: {
        projectId: 'project-1', targetType: 'TASK', targetId: 'task-1', reviewerIds: ['user-2'],
        instructions: 'Please check the API.', idempotencyKey: 'review-create-key',
      },
    })
    await client.callTool({
      name: 'update_review_request',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', expectedRevision: 4, instructions: 'Updated request.' },
    })
    await client.callTool({
      name: 'respond_to_review_request',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', outcome: 'APPROVED', expectedUpdatedAt },
    })
    await client.callTool({
      name: 'list_review_comments',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1' },
    })
    await client.callTool({
      name: 'add_review_comment',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', content: 'Looks good.', idempotencyKey: 'review-comment-key' },
    })
    await client.callTool({
      name: 'add_review_checklist_item',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', title: 'Confirm the route.', idempotencyKey: 'review-checklist-key' },
    })
    await client.callTool({
      name: 'update_review_checklist_item',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', itemId: 'item-1', completed: true, expectedUpdatedAt },
    })
    await client.callTool({
      name: 'complete_review_request',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', expectedRevision: 5 },
    })
    await client.callTool({
      name: 'cancel_review_request',
      arguments: { projectId: 'project-1', reviewRequestId: 'review-1', expectedRevision: 6 },
    })

    assert.deepEqual(calls, [
      {
        method: 'GET',
        path: '/api/external/projects/project-1/review-requests',
        query: { targetType: 'TASK', state: 'OPEN', page: 1, limit: 20 },
      },
      {
        method: 'GET',
        path: '/api/external/projects/project-1/review-requests/review-1',
        query: undefined,
      },
      {
        method: 'POST',
        path: '/api/external/projects/project-1/review-requests',
        body: { targetType: 'TASK', targetId: 'task-1', reviewerIds: ['user-2'], instructions: 'Please check the API.' },
        idempotencyKey: 'review-create-key',
      },
      {
        method: 'PATCH',
        path: '/api/external/projects/project-1/review-requests/review-1',
        body: { expectedRevision: 4, instructions: 'Updated request.' },
      },
      {
        method: 'POST',
        path: '/api/external/projects/project-1/review-requests/review-1/responses',
        body: { outcome: 'APPROVED', expectedUpdatedAt },
        idempotencyKey: undefined,
      },
      {
        method: 'GET',
        path: '/api/external/projects/project-1/review-requests/review-1/comments',
        query: undefined,
      },
      {
        method: 'POST',
        path: '/api/external/projects/project-1/review-requests/review-1/comments',
        body: { content: 'Looks good.' },
        idempotencyKey: 'review-comment-key',
      },
      {
        method: 'POST',
        path: '/api/external/projects/project-1/review-requests/review-1/checklist',
        body: { title: 'Confirm the route.' },
        idempotencyKey: 'review-checklist-key',
      },
      {
        method: 'PATCH',
        path: '/api/external/projects/project-1/review-requests/review-1/checklist/item-1',
        body: { completed: true, expectedUpdatedAt },
      },
      {
        method: 'PATCH',
        path: '/api/external/projects/project-1/review-requests/review-1',
        body: { state: 'COMPLETED', expectedRevision: 5 },
      },
      {
        method: 'PATCH',
        path: '/api/external/projects/project-1/review-requests/review-1',
        body: { state: 'CANCELLED', expectedRevision: 6 },
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})

test('lets the server choose a safe end time for an immediate timer stop', async () => {
  const calls = []
  const timerApi = {
    ...api,
    post: async (path, body) => { calls.push({ path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(timerApi)
  const client = new Client({ name: 'timer-stop-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'stop_ticket_timer',
      arguments: {
        projectId: 'project-1', taskId: 'task-1', timeEntryId: 'time-1',
        expectedUpdatedAt: '2026-08-09T12:00:00.000Z',
      },
    })

    assert.deepEqual(calls, [{
      path: '/api/external/projects/project-1/tasks/task-1/time-entries/time-1/stop',
      body: { expectedUpdatedAt: '2026-08-09T12:00:00.000Z' },
    }])
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
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return { tasks: [] } },
    post: async (path, body) => { calls.push({ method: 'POST', path, body }); return { task: {}, claim: {} } },
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return { entity: {} } },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return { entity: {} } },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(claimApi)
  const client = new Client({ name: 'task-claim-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'list_available_work',
      arguments: { projectId: 'project-1', priority: 'HIGH', limit: 10 },
    })
    await client.callTool({
      name: 'claim_ticket',
      arguments: { taskId: 'task-1', runId: 'run-1' },
    })
    await client.callTool({
      name: 'renew_ticket_claim',
      arguments: { taskId: 'task-1', runId: 'run-1', leaseSeconds: 600 },
    })
    await client.callTool({
      name: 'claim_next_ticket',
      arguments: { projectId: 'project-1', runId: 'run-next' },
    })
    await client.callTool({
      name: 'claim_ticket',
      arguments: { taskId: 'task-1', runId: 'run-1', state: 'WAITING', leaseSeconds: 300 },
    })
    await client.callTool({
      name: 'release_ticket',
      arguments: { taskId: 'task-1', runId: 'run-1' },
    })

    assert.deepEqual(calls, [
      {
        method: 'GET',
        path: '/api/external/work-queue/available',
        query: { projectId: 'project-1', status: 'TODO', priority: 'HIGH', page: 1, limit: 10 },
      },
      {
        method: 'PUT',
        path: '/api/external/tasks/task-1/claim',
        body: { runId: 'run-1', state: 'ACTIVE', leaseSeconds: 900 },
      },
      {
        method: 'PUT',
        path: '/api/external/tasks/task-1/claim',
        body: { runId: 'run-1', state: 'ACTIVE', leaseSeconds: 600 },
      },
      {
        method: 'POST',
        path: '/api/external/work-queue/available',
        body: {
          projectId: 'project-1', runId: 'run-next', status: 'TODO',
          state: 'ACTIVE', leaseSeconds: 900,
        },
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
    await client.callTool({ name: 'add_ticket_to_focus', arguments: { taskId: 'task-1', bucket: 'NEXT', idempotencyKey: 'focus-key-1' } })
    await client.callTool({ name: 'move_focus_ticket', arguments: { taskId: 'task-1', bucket: 'LATER', position: 3, expectedUpdatedAt: '2026-07-28T12:00:00.000Z' } })
    await client.callTool({ name: 'remove_ticket_from_focus', arguments: { taskId: 'task-1' } })

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
      name: 'preview_ticket_move',
      arguments: { taskId: 'task-1', planId: 'plan-2', sectionId: 'section-2', expectedUpdatedAt },
    })
    await client.callTool({
      name: 'move_ticket',
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
  const server = createToDoddleMcpServer(uploadApi, { managedUploadRoot: directory })
  const client = new Client({ name: 'upload-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const result = await client.callTool({
      name: 'attach_file_to_ticket',
      arguments: { projectId: 'project-1', taskId: 'task-1', filePath },
    })
    assert.equal(result.isError, undefined)
    assert.equal(calls[0].path, '/api/external/projects/project-1/documents/upload-sessions')
    assert.equal(calls[0].body.creationSource, 'TASK_ATTACHMENT')
    assert.equal(calls[1].content, 'verified evidence')
    assert.equal(calls[2].path, '/api/external/projects/project-1/documents/document-1/finalize')
    assert.deepEqual(calls[2].body, { success: true, taskId: 'task-1' })
    await assert.rejects(readFile(filePath, 'utf8'), { code: 'ENOENT' })
  } finally {
    await client.close()
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('retains a managed local file when upload finalization is uncertain', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-mcp-failed-upload-test-'))
  const operationDirectory = join(directory, 'operation-1')
  const filePath = join(operationDirectory, 'evidence.txt')
  await mkdir(operationDirectory)
  await writeFile(filePath, 'retry evidence')
  const uploadApi = {
    ...api,
    post: async path => {
      if (path.endsWith('/upload-sessions')) {
        return {
          session: {
            documentId: 'document-1',
            uploadUrl: 'https://storage.example/upload',
            headers: { 'Content-Type': 'text/plain' },
          },
        }
      }
      throw new Error('finalization result is unknown')
    },
  }

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(uploadApi, { managedUploadRoot: directory })
  const client = new Client({ name: 'failed-upload-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const result = await client.callTool({
      name: 'upload_project_document',
      arguments: { projectId: 'project-1', filePath },
    })
    assert.equal(result.isError, true)
    assert.match(result.content[0].text, /finalization result is unknown/)
    assert.equal(await readFile(filePath, 'utf8'), 'retry evidence')
  } finally {
    await client.close()
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('creates and completes a direct upload without handling file bytes', async () => {
  const calls = []
  const directUploadApi = {
    ...api,
    post: async (path, body, idempotencyKey) => {
      calls.push({ path, body, idempotencyKey })
      return path.endsWith('/upload-sessions')
        ? { session: { documentId: 'document-1', uploadUrl: 'https://storage.example/signed' } }
        : { entity: { document: { id: 'document-1' } } }
    },
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(directUploadApi)
  const client = new Client({ name: 'direct-upload-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    await client.callTool({
      name: 'begin_upload',
      arguments: {
        projectId: 'project-1',
        taskId: 'task-1',
        fileName: 'evidence.txt',
        fileSize: 17,
        contentType: 'text/plain',
        idempotencyKey: 'begin-upload-1',
      },
    })
    await client.callTool({
      name: 'complete_upload',
      arguments: {
        projectId: 'project-1',
        documentId: 'document-1',
        taskId: 'task-1',
        success: true,
        idempotencyKey: 'complete-upload-1',
      },
    })

    assert.deepEqual(calls, [
      {
        path: '/api/external/projects/project-1/documents/upload-sessions',
        body: {
          fileName: 'evidence.txt',
          fileSize: 17,
          contentType: 'text/plain',
          description: undefined,
          folderId: undefined,
          creationSource: 'TASK_ATTACHMENT',
        },
        idempotencyKey: 'begin-upload-1',
      },
      {
        path: '/api/external/projects/project-1/documents/document-1/finalize',
        body: { taskId: 'task-1', success: true },
        idempotencyKey: 'complete-upload-1',
      },
    ])
  } finally {
    await client.close()
    await server.close()
  }
})
