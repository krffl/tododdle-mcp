import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { loadMcpConfig } from '../dist/config.js'
import { createTrackingTimeMcpServer } from '../dist/server.js'

const api = {
  get: async () => ({ items: [] }),
  post: async () => ({ entity: {} }),
  put: async () => ({ entity: {} }),
  patch: async () => ({ entity: {} }),
  delete: async () => ({ entity: {} }),
}

test('discovers the bounded production tool surface', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createTrackingTimeMcpServer(api)
  const client = new Client({ name: 'package-test', version: '1.0.0' })

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const result = await client.listTools()
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

  await client.close()
  await server.close()
})

test('uses production by default and requires only Agent Connection credentials', () => {
  assert.deepEqual(
    loadMcpConfig({
      TRACKINGTIME_CLIENT_ID: 'client-id',
      TRACKINGTIME_CLIENT_SECRET: 'client-secret',
    }),
    {
      baseUrl: 'https://trackingti.me',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    }
  )

  assert.throws(() => loadMcpConfig({}), /TRACKINGTIME_CLIENT_ID and TRACKINGTIME_CLIENT_SECRET/)
})
