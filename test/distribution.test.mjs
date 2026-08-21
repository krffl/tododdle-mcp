import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('npm package includes the Codex workflow distribution', async () => {
  const packageJson = await readJson('../package.json');

  assert.ok(packageJson.files.includes('.codex-plugin'));
  assert.ok(packageJson.files.includes('skills'));
  assert.ok(packageJson.files.includes('examples'));
  assert.ok(packageJson.files.includes('config'));
  const parity = await readJson('../config/external-api-parity.json');
  assert.ok(Object.keys(parity.tools).length > 0);
  assert.ok(Object.keys(parity.exceptions).length > 0);
});

test('npm package entrypoint is executable by npx', async () => {
  const entrypoint = await stat(new URL('../dist/index.js', import.meta.url));

  assert.notEqual(entrypoint.mode & 0o111, 0);
});

test('Codex plugin and marketplace target the published package', async () => {
  const packageJson = await readJson('../package.json');
  const plugin = await readJson('../.codex-plugin/plugin.json');
  const marketplace = await readJson('../.agents/plugins/marketplace.json');
  const { MCP_PACKAGE_VERSION } = await import('../dist/compatibility.js');
  const entry = marketplace.plugins[0];

  assert.equal(MCP_PACKAGE_VERSION, packageJson.version);
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
  const scheduledWorkflows = await readFile(
    new URL(
      '../skills/tododdle-workflow/references/scheduled-workflows.md',
      import.meta.url,
    ),
    'utf8',
  );
  const metadata = await readFile(
    new URL('../skills/tododdle-workflow/agents/openai.yaml', import.meta.url),
    'utf8',
  );

  assert.match(skill, /get_project_brief/);
  assert.match(skill, /Simple lookup/);
  assert.match(skill, /Substantial planning or implementation/);
  assert.match(skill, /Refresh volatile fields/);
  assert.match(skill, /Do not fan out across every status or endpoint/);
  assert.match(skill, /Prefer `list_tickets`/);
  assert.match(skill, /default compact response/);
  assert.match(skill, /Do not request `detail: full`/);
  assert.match(skill, /list_project_members/);
  assert.match(skill, /Archive projects, boards, lanes, or Notes only with explicit approval/);
  assert.match(skill, /COMPLETE/);
  assert.match(skill, /Do not invent elapsed time/);
  assert.match(skill, /typed `HANDOFF` comment/);
  assert.match(skill, /## Outcome/);
  assert.match(skill, /## Verification/);
  assert.match(skill, /## Remaining/);
  assert.match(skill, /Never persist expiring download or upload token URLs/);
  assert.match(skill, /After the upload tool confirms success, delete only the temporary staging file/);
  assert.match(skill, /For a pasted or clipboard image/);
  assert.match(skill, /create a private temporary directory inside it with `mktemp -d`/);
  assert.match(skill, /preserve a suitable image extension/);
  assert.match(skill, /Do not alter the original clipboard attachment/);
  assert.match(skill, /Never delete the user's original source file/);
  assert.match(skill, /For a remote hosted connection, use `begin_upload`/);
  assert.match(skill, /upload the bytes from the user's device directly/);
  assert.match(skill, /The hosted gateway must not receive or stage the file bytes/);
  assert.match(skill, /Do not encode the file into MCP arguments/);
  assert.match(skill, /Request a fresh tokenized URL with `get_document_download_url`/);
  assert.match(skill, /private temporary directory with `mktemp -d`/);
  assert.match(skill, /without printing, logging, or persisting the URL/);
  assert.match(skill, /inspect the local file with the appropriate image or document tool/);
  assert.match(skill, /Use a browser only when local download or rendering is unavailable/);
  assert.match(skill, /After successful inspection, delete only the temporary files and directory/);
  assert.match(skill, /handle the reply before acknowledging it/);
  assert.match(skill, /Installing the plugin must never create or enable a schedule/);
  assert.match(skill, /Default to read and report/);
  assert.match(skill, /application's durable queue or cron system/);
  assert.match(scheduledWorkflows, /Recipe: Morning Control Tower/);
  assert.match(scheduledWorkflows, /Recipe: Ticket Review Sweep/);
  assert.match(scheduledWorkflows, /Recipe: Weekly Backlog Hygiene/);
  assert.match(scheduledWorkflows, /Recipe: Weekly Roadmap Summary/);
  assert.match(scheduledWorkflows, /Recipe: Agent Inbox Follow-up/);
  assert.match(scheduledWorkflows, /Recipe: Local Release Verification/);
  assert.match(scheduledWorkflows, /Formal review-request queues require future MCP review tools/);
  assert.match(scheduledWorkflows, /Do not acknowledge a reply/);
  assert.match(scheduledWorkflows, /Do not complete the ticket automatically/);
  assert.match(scheduledWorkflows, /server-owned queue or cron system/);
  assert.match(metadata, /value: "tododdle"/);
  assert.match(metadata, /allow_implicit_invocation: true/);
});

test('suggested AGENTS rules require concise, human ticket writing', async () => {
  const agents = await readFile(new URL('../examples/AGENTS.tododdle.md', import.meta.url), 'utf8');

  assert.match(agents, /ticket titles, ticket descriptions, comments, status updates, handoffs/);
  assert.match(agents, /ASD-STE100 Simplified Technical English/);
  assert.match(agents, /simplicity, brevity, clarity, and humanity/);
  assert.match(agents, /readable Markdown/);
});

test('README documents bounded and compaction-safe context loading', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /Bounded Project Context/);
  assert.match(readme, /get_project_brief` once/);
  assert.match(readme, /get_project_context` once/);
  assert.match(readme, /follow their pagination metadata/);
  assert.match(readme, /compaction summary/);
  assert.match(readme, /Refresh only volatile ticket state/);
  assert.match(readme, /Simple lookups should skip the brief and full context entirely/);
});

test('README documents opt-in scheduled workflow recipes', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /Scheduled ToDoddle Workflows/);
  assert.match(readme, /Installing the plugin never creates a schedule/);
  assert.match(readme, /confirm the timezone, project, cadence, and allowed mutation level/);
  assert.match(readme, /server-owned queue or cron system/);
});
