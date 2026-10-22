import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const inventoryPath = resolve(
  process.argv[2] || '../trackingti.me/src/config/api-route-inventory.json'
)
const manifestPath = new URL('../config/external-api-parity.json', import.meta.url)
// The app's security event types sit next to its route inventory.
const appSecurityTypesPath = resolve(inventoryPath, '../../lib/types/security.ts')
const serverPath = new URL('../src/server.ts', import.meta.url)
const [inventory, parity, appSecurityTypes, server] = await Promise.all([
  readFile(inventoryPath, 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8').then(JSON.parse),
  readFile(appSecurityTypesPath, 'utf8'),
  readFile(serverPath, 'utf8'),
])

/** The quoted names in an `= [ ... ] as const` list that follows `marker`. */
function quotedList(source, marker) {
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`Cannot find ${marker}`)
  const body = source.slice(start, source.indexOf(']', start))
  return [...body.matchAll(/'([A-Z0-9_]+)'/g)].map(match => match[1])
}
const appEventTypes = quotedList(appSecurityTypes, 'SECURITY_EVENT_TYPES = [')
const toolEventTypes = quotedList(server, 'const securityEventTypes = [')
const missingEventTypes = appEventTypes.filter(type => !toolEventTypes.includes(type))
const extraEventTypes = toolEventTypes.filter(type => !appEventTypes.includes(type))

const apiMethods = new Set(
  inventory.routes
    .filter(route => route.classification === 'external-mcp')
    .flatMap(route => route.methods.map(method => `${method.method} ${route.route}`))
)
const accountedMethods = new Set([
  ...Object.values(parity.tools).flat(),
  ...Object.keys(parity.exceptions),
])
const missing = [...apiMethods].filter(method => !accountedMethods.has(method)).sort()
const extra = [...accountedMethods].filter(method => !apiMethods.has(method)).sort()

if (missing.length || extra.length || missingEventTypes.length || extraEventTypes.length) {
  console.error(JSON.stringify({ inventoryPath, missing, extra, missingEventTypes, extraEventTypes }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    inventoryPath,
    apiMethods: apiMethods.size,
    tools: Object.keys(parity.tools).length,
    exceptions: Object.keys(parity.exceptions).length,
    missing: 0,
    extra: 0,
    securityEventTypes: toolEventTypes.length,
  }))
}
