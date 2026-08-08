import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const inventoryPath = resolve(
  process.argv[2] || '../trackingti.me/src/config/api-route-inventory.json'
)
const manifestPath = new URL('../config/external-api-parity.json', import.meta.url)
const [inventory, parity] = await Promise.all([
  readFile(inventoryPath, 'utf8').then(JSON.parse),
  readFile(manifestPath, 'utf8').then(JSON.parse),
])

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

if (missing.length || extra.length) {
  console.error(JSON.stringify({ inventoryPath, missing, extra }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    inventoryPath,
    apiMethods: apiMethods.size,
    tools: Object.keys(parity.tools).length,
    exceptions: Object.keys(parity.exceptions).length,
    missing: 0,
    extra: 0,
  }))
}
