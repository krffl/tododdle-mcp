import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ToDoddleApiClient, ToDoddleApiError } from '../dist/api-client.js'
import {
  MCP_COMPATIBILITY_HEADER,
  MCP_COMPATIBILITY_LEVEL,
  MCP_PACKAGE_VERSION,
  MCP_VERSION_HEADER,
} from '../dist/compatibility.js'

const config = {
  baseUrl: 'https://www.tododdle.com',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  uploadRoots: [],
  maxUploadBytes: 1024,
}

test('refreshes once after 401 and preserves structured API errors', async () => {
  const originalFetch = globalThis.fetch
  let tokenRequests = 0
  let apiRequests = 0
  globalThis.fetch = async input => {
    if (String(input).endsWith('/api/external/oauth/token')) {
      tokenRequests += 1
      return new Response(JSON.stringify({ access_token: `token-${tokenRequests}`, expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    apiRequests += 1
    if (apiRequests === 1) return new Response('{}', { status: 401 })
    return new Response(JSON.stringify({
      error: 'permission_denied',
      message: 'Project access denied',
      details: { projectId: 'project-1' },
    }), { status: 403, headers: { 'content-type': 'application/json' } })
  }

  try {
    const client = new ToDoddleApiClient(config)
    await assert.rejects(
      () => client.get('/api/external/projects/project-1'),
      error => error instanceof ToDoddleApiError
        && error.status === 403
        && error.code === 'permission_denied'
        && error.message === 'Project access denied'
        && error.details?.projectId === 'project-1',
    )
    assert.equal(tokenRequests, 2)
    assert.equal(apiRequests, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('sends package compatibility metadata with token and API requests', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (input, init) => {
    requests.push({ input: String(input), headers: new Headers(init?.headers) })
    if (String(input).endsWith('/api/external/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), {
        status: 200,
      })
    }
    return new Response(JSON.stringify({ projects: [] }), { status: 200 })
  }

  try {
    await new ToDoddleApiClient(config).get('/api/external/projects')
    assert.equal(requests.length, 2)
    for (const request of requests) {
      assert.equal(request.headers.get(MCP_VERSION_HEADER), MCP_PACKAGE_VERSION)
      assert.equal(request.headers.get(MCP_COMPATIBILITY_HEADER), String(MCP_COMPATIBILITY_LEVEL))
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('turns update-required responses into direct agent guidance', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'MCP_UPDATE_REQUIRED',
    message: 'This ToDoddle MCP is not compatible.',
    details: {
      installedVersion: '2.8.0',
      minimumCompatibilityLevel: 3,
      updateCommand: 'npx --yes --prefer-online tododdle-mcp@latest',
      documentationUrl: 'https://www.tododdle.com/docs/agents/install-mcp',
      restartRequired: true,
    },
  }), { status: 426 })

  try {
    await assert.rejects(
      () => new ToDoddleApiClient(config).get('/api/external/projects'),
      error => error instanceof ToDoddleApiError
        && error.code === 'MCP_UPDATE_REQUIRED'
        && error.message.includes('Ask the user to run')
        && error.message.includes('restart Codex'),
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fails closed on malformed token and non-JSON provider responses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: '' }), { status: 200 })
  try {
    await assert.rejects(
      () => new ToDoddleApiClient(config).get('/api/external/projects'),
      /Token endpoint returned an invalid response/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }

  globalThis.fetch = async input => String(input).endsWith('/oauth/token')
    ? new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200 })
    : new Response('upstream unavailable', { status: 502 })
  try {
    await assert.rejects(
      () => new ToDoddleApiClient(config).get('/api/external/projects'),
      error => error instanceof ToDoddleApiError
        && error.status === 502
        && error.code === 'server_error'
        && error.message === 'ToDoddle request failed (502)',
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('reports direct-storage upload failures without parsing untrusted bodies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tododdle-api-upload-'))
  const filePath = join(directory, 'upload.txt')
  await writeFile(filePath, 'upload')
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('too large', { status: 413 })

  try {
    await assert.rejects(
      () => new ToDoddleApiClient(config).uploadFile(
        'https://storage.example/upload', { 'Content-Type': 'text/plain' }, filePath, 6,
      ),
      /Direct upload failed \(413\)/,
    )
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})
