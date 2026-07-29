import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('npm package includes the Codex workflow distribution', async () => {
  const packageJson = await readJson('../package.json');

  assert.ok(packageJson.files.includes('.codex-plugin'));
  assert.ok(packageJson.files.includes('skills'));
  assert.ok(packageJson.files.includes('examples'));
});

test('npm package entrypoint is executable by npx', async () => {
  const entrypoint = await stat(new URL('../dist/index.js', import.meta.url));

  assert.notEqual(entrypoint.mode & 0o111, 0);
});

test('Codex plugin and marketplace target the published package', async () => {
  const packageJson = await readJson('../package.json');
  const plugin = await readJson('../.codex-plugin/plugin.json');
  const marketplace = await readJson('../.agents/plugins/marketplace.json');
  const entry = marketplace.plugins[0];

  assert.equal(plugin.name, 'tododdle');
  assert.equal(plugin.version, packageJson.version);
  assert.equal(plugin.skills, './skills/');
  assert.equal(entry.name, plugin.name);
  assert.equal(entry.source.source, 'npm');
  assert.equal(entry.source.package, packageJson.name);
  assert.equal(entry.source.version, `^${packageJson.version}`);
});

test('workflow skill declares the MCP dependency and core safety rules', async () => {
  const skill = await readFile(new URL('../skills/tododdle-workflow/SKILL.md', import.meta.url), 'utf8');
  const metadata = await readFile(
    new URL('../skills/tododdle-workflow/agents/openai.yaml', import.meta.url),
    'utf8',
  );

  assert.match(skill, /get_project_brief/);
  assert.match(skill, /COMPLETE/);
  assert.match(skill, /Do not invent elapsed time/);
  assert.match(metadata, /value: "tododdle"/);
  assert.match(metadata, /allow_implicit_invocation: true/);
});
