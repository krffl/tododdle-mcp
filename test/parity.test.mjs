import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createToDoddleMcpServer } from '../dist/server.js'

const parity = JSON.parse(
  await readFile(new URL('../config/external-api-parity.json', import.meta.url), 'utf8')
)

function exampleValue(schema, key) {
  if (schema.const !== undefined) return schema.const
  if (Array.isArray(schema.enum)) return schema.enum[0]
  if (Array.isArray(schema.type)) {
    return exampleValue({ ...schema, type: schema.type.find(type => type !== 'null') || 'null' }, key)
  }
  if (Array.isArray(schema.anyOf)) {
    const option = schema.anyOf.find(candidate => candidate.type !== 'null') || schema.anyOf[0]
    return exampleValue(option, key)
  }
  if (Array.isArray(schema.oneOf)) return exampleValue(schema.oneOf[0], key)
  if (schema.type === 'string') {
    if (schema.format === 'date-time') return '2026-08-08T12:00:00.000Z'
    if (schema.format === 'uri') return 'https://example.com/source.txt'
    if (key?.endsWith('Id')) return `${key}-value`
    if (key === 'color') return '#112233'
    return `${key || 'value'}-value`
  }
  if (schema.type === 'integer' || schema.type === 'number') return schema.minimum ?? 0
  if (schema.type === 'boolean') return false
  if (schema.type === 'array') return []
  if (schema.type === 'object' || schema.properties) {
    return Object.fromEntries(
      (schema.required || []).map(property => [
        property,
        exampleValue(schema.properties[property], property),
      ])
    )
  }
  throw new Error(`No example generator for ${key || 'schema'}: ${JSON.stringify(schema)}`)
}

function endpointMatches(call, endpoint) {
  const separator = endpoint.indexOf(' ')
  const method = endpoint.slice(0, separator)
  const route = endpoint.slice(separator + 1)
  const routePattern = route
    .split('/')
    .map(part => /^\[[^\]]+\]$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/')
  return call.method === method && new RegExp(`^${routePattern}$`).test(call.path)
}

test('parity manifest accounts for every discovered tool without a historic count', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer({
    get: async () => ({}), post: async () => ({}), put: async () => ({}),
    patch: async () => ({}), delete: async () => ({}), uploadFile: async () => undefined,
  })
  const client = new Client({ name: 'parity-discovery-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const discovered = (await client.listTools()).tools.map(tool => tool.name).sort()
    const documented = Object.keys(parity.tools).sort()
    assert.deepEqual(discovered, documented)

    const mapped = new Set(Object.values(parity.tools).flat())
    for (const [endpoint, reason] of Object.entries(parity.exceptions)) {
      assert.equal(mapped.has(endpoint), false, `${endpoint} cannot be both mapped and excepted`)
      assert.ok(reason.length >= 40, `${endpoint} needs a durable exception reason`)
    }
  } finally {
    await client.close()
    await server.close()
  }
})

test('every discovered tool validates and serializes only to documented External API methods', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-mcp-parity-'))
  const filePath = join(directory, 'evidence.txt')
  await writeFile(filePath, 'parity evidence')
  const calls = []
  const api = {
    get: async (path, query) => { calls.push({ method: 'GET', path, query }); return {} },
    post: async (path, body, idempotencyKey) => {
      calls.push({ method: 'POST', path, body, idempotencyKey })
      if (path.endsWith('/upload-sessions')) {
        return {
          session: {
            documentId: 'document-value',
            uploadUrl: 'https://storage.example/upload',
            headers: { 'Content-Type': 'text/plain' },
          },
        }
      }
      return {}
    },
    put: async (path, body) => { calls.push({ method: 'PUT', path, body }); return {} },
    patch: async (path, body) => { calls.push({ method: 'PATCH', path, body }); return {} },
    delete: async (path, body) => { calls.push({ method: 'DELETE', path, body }); return {} },
    uploadFile: async () => undefined,
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(api, { uploadRoots: [directory] })
  const client = new Client({ name: 'parity-serialization-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    const tools = (await client.listTools()).tools
    for (const tool of tools) {
      calls.length = 0
      const argumentsValue = exampleValue(tool.inputSchema)
      if (tool.name === 'upload_project_document' || tool.name === 'attach_file_to_ticket') {
        argumentsValue.projectId = 'projectId-value'
        argumentsValue.filePath = filePath
        if (tool.name === 'attach_file_to_ticket') argumentsValue.taskId = 'taskId-value'
      }

      const result = await client.callTool({ name: tool.name, arguments: argumentsValue })
      assert.equal(result.isError, undefined, `${tool.name} rejected generated valid input`)
      assert.ok(calls.length > 0, `${tool.name} did not call the External API`)
      for (const call of calls) {
        assert.ok(
          parity.tools[tool.name].some(endpoint => endpointMatches(call, endpoint)),
          `${tool.name} made undocumented call ${call.method} ${call.path}`
        )
      }
    }
  } finally {
    await client.close()
    await server.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('bounded read schemas reject oversized pages and malformed identifiers', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer({
    get: async () => ({}), post: async () => ({}), put: async () => ({}),
    patch: async () => ({}), delete: async () => ({}), uploadFile: async () => undefined,
  })
  const client = new Client({ name: 'parity-validation-test', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  try {
    for (const name of ['list_projects', 'list_tickets', 'list_boards', 'list_lanes', 'list_notes']) {
      const base = name === 'list_boards'
        ? { projectId: 'project-1' }
        : name === 'list_lanes'
          ? { projectId: 'project-1', planId: 'plan-1' }
          : {}
      const result = await client.callTool({ name, arguments: { ...base, limit: 101 } })
      assert.equal(result.isError, true, `${name} must reject limit > 100`)
    }
    assert.equal((await client.callTool({ name: 'get_ticket', arguments: { taskId: '' } })).isError, true)
    assert.equal((await client.callTool({
      name: 'update_ticket',
      arguments: { taskId: 'task-1', expectedUpdatedAt: 'not-a-date' },
    })).isError, true)
    assert.equal((await client.callTool({
      name: 'upload_project_document',
      arguments: { projectId: 'project-1' },
    })).isError, true)
    assert.equal((await client.callTool({
      name: 'upload_project_document',
      arguments: {
        projectId: 'project-1',
        filePath: '/tmp/evidence.txt',
        sourceUrl: 'https://example.com/evidence.txt',
      },
    })).isError, true)
  } finally {
    await client.close()
    await server.close()
  }
})
