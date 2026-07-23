import assert from 'node:assert/strict'
import test from 'node:test'
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
}

test('discovers the bounded production tool surface', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createToDoddleMcpServer(api)
  const client = new Client({ name: 'package-test', version: '1.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const result = await client.listTools()
  const resources = await client.listResourceTemplates()
  const names = result.tools.map(tool => tool.name)

  assert.equal(result.tools.length, 29)
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
    }
  )

  assert.throws(() => loadMcpConfig({}), /TODODDLE_CLIENT_ID and TODODDLE_CLIENT_SECRET/)
})
