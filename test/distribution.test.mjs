import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('npm package includes the Codex workflow distribution', async () => {
  const packageJson = await readJson('../package.json');

  assert.ok(packageJson.files.includes('.codex-plugin'));
  assert.ok(packageJson.files.includes('.claude-plugin'));
  assert.ok(packageJson.files.includes('skills'));
  assert.ok(packageJson.files.includes('examples'));
  assert.ok(packageJson.files.includes('config'));
  const parity = await readJson('../config/external-api-parity.json');
  assert.ok(Object.keys(parity.tools).length > 0);
  assert.ok(Object.keys(parity.exceptions).length > 0);
});

test('Claude Code plugin and marketplace distribute the canonical workflow skill', async () => {
  const packageJson = await readJson('../package.json');
  const plugin = await readJson('../.claude-plugin/plugin.json');
  const marketplace = await readJson('../.claude-plugin/marketplace.json');
  const entry = marketplace.plugins[0];

  assert.equal(plugin.name, 'tododdle');
  assert.equal(plugin.version, packageJson.version);
  assert.equal(marketplace.name, 'tododdle');
  assert.equal(marketplace.version, packageJson.version);
  assert.equal(entry.name, plugin.name);
  assert.equal(entry.version, packageJson.version);
  assert.equal(entry.source.source, 'npm');
  assert.equal(entry.source.package, packageJson.name);
  assert.equal(entry.source.version, packageJson.version);
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
  const files = await readFile(
    new URL('../skills/tododdle-workflow/references/files.md', import.meta.url),
    'utf8',
  );
  const projectWork = await readFile(
    new URL(
      '../skills/tododdle-workflow/references/project-work.md',
      import.meta.url,
    ),
    'utf8',
  );
  const timeTracking = await readFile(
    new URL(
      '../skills/tododdle-workflow/references/time-tracking.md',
      import.meta.url,
    ),
    'utf8',
  );
  const metadata = await readFile(
    new URL('../skills/tododdle-workflow/agents/openai.yaml', import.meta.url),
    'utf8',
  );

  assert.match(skill, /get_project_brief/);
  assert.match(skill, /Read Context summaries before full Markdown/);
  assert.match(skill, /summary of no more than 500 characters/);
  assert.match(skill, /missing-summary warning/);
  assert.match(skill, /Simple lookup/);
  assert.match(skill, /Substantial work/);
  assert.match(skill, /Refresh only volatile status/);
  assert.match(skill, /Do not fan out across all statuses or endpoints/);
  assert.match(skill, /Prefer compact, bounded lists/);
  assert.match(skill, /Do not request full list detail/);
  assert.match(skill, /list_project_members/);
  assert.match(projectWork, /Archive a project, board, lane, or Note only with explicit approval/);
  assert.match(projectWork, /Pass `parentArtifactId` when a Context artifact belongs under another artifact/);
  assert.match(projectWork, /Set it to `null` on update to move the artifact to the top level/);
  assert.match(skill, /COMPLETE/);
  assert.match(timeTracking, /Never invent elapsed time/);
  assert.match(skill, /typed `HANDOFF` comment/);
  assert.match(skill, /## Outcome/);
  assert.match(skill, /## Verification/);
  assert.match(skill, /## Remaining/);
  assert.match(skill, /\[files\.md\]\(references\/files\.md\)/);
  assert.match(skill, /\[project-work\.md\]\(references\/project-work\.md\)/);
  assert.match(skill, /\[time-tracking\.md\]\(references\/time-tracking\.md\)/);
  assert.match(skill, /\[scheduled-workflows\.md\]\(references\/scheduled-workflows\.md\)/);
  assert.match(files, /After confirmed success, the local MCP deletes the staged file/);
  assert.match(files, /For a clipboard image/);
  assert.match(files, /private directory with `mktemp -d`/);
  assert.match(files, /`TODODDLE_UPLOAD_ROOTS` is optional/);
  assert.match(files, /Never approve the full system temporary directory/);
  assert.match(files, /keep a suitable extension/);
  assert.match(files, /Do not alter the original/);
  assert.match(files, /Never delete the user’s original/);
  assert.match(files, /Call `begin_upload`/);
  assert.match(files, /Upload bytes from the user’s device directly/);
  assert.match(files, /hosted gateway must not receive or stage file bytes/);
  assert.match(files, /Do not put base64 file data in MCP arguments/);
  assert.match(files, /Request a fresh URL with `get_document_download_url`/);
  assert.match(files, /Download without printing, logging, or storing the URL/);
  assert.match(files, /Inspect the local file with the appropriate image or document tool/);
  assert.match(files, /Use the browser only when local download or rendering is unavailable/);
  assert.match(files, /After successful inspection, delete only the temporary files and directory/);
  assert.match(skill, /Acknowledge an item only after handling it/);
  assert.match(scheduledWorkflows, /Do not activate a schedule during plugin installation/);
  assert.match(scheduledWorkflows, /Default to \*\*read and report\*\*/);
  assert.match(scheduledWorkflows, /server-owned queue or cron system/);
  assert.match(scheduledWorkflows, /Recipe: Morning Control Tower/);
  assert.match(scheduledWorkflows, /Recipe: Ticket Review Sweep/);
  assert.match(scheduledWorkflows, /Recipe: Weekly Backlog Hygiene/);
  assert.match(scheduledWorkflows, /Recipe: Weekly Roadmap Summary/);
  assert.match(scheduledWorkflows, /Recipe: Agent Inbox Follow-up/);
  assert.match(scheduledWorkflows, /Recipe: Local Release Verification/);
  assert.match(scheduledWorkflows, /Use `list_review_requests` separately when formal review requests need attention/);
  assert.match(scheduledWorkflows, /Do not acknowledge a reply/);
  assert.match(scheduledWorkflows, /Do not complete the ticket automatically/);
  assert.match(scheduledWorkflows, /server-owned queue or cron system/);
  assert.match(metadata, /value: "tododdle"/);
  assert.match(metadata, /allow_implicit_invocation: true/);
});

test('bootstrap skill safely binds an existing repository to a verified project', async () => {
  const skill = await readFile(
    new URL('../skills/tododdle-bootstrap/SKILL.md', import.meta.url),
    'utf8'
  );
  const metadata = await readFile(
    new URL('../skills/tododdle-bootstrap/agents/openai.yaml', import.meta.url),
    'utf8'
  );
  const updater = await readFile(
    new URL('../skills/tododdle-bootstrap/scripts/update-agents.mjs', import.meta.url),
    'utf8'
  );

  assert.match(skill, /Verify the target project through ToDoddle/);
  assert.match(skill, /`AGENTS\.override\.md` takes precedence/);
  assert.match(skill, /Run it with `--dry-run` first/);
  assert.match(skill, /start a new agent task or restart the agent host/);
  assert.match(skill, /Preserve all content outside/);
  assert.match(skill, /Stop on unmatched or duplicate markers/);
  assert.match(metadata, /value: "tododdle"/);
  assert.match(metadata, /\$tododdle-bootstrap/);
  assert.match(updater, /<!-- tododdle:start -->/);
  assert.match(updater, /Malformed ToDoddle markers/);
});

test('factory skill scopes autonomous delivery and preserves human control', async () => {
  const skill = await readFile(
    new URL('../skills/tododdle-factory/SKILL.md', import.meta.url),
    'utf8'
  );
  const metadata = await readFile(
    new URL('../skills/tododdle-factory/agents/openai.yaml', import.meta.url),
    'utf8'
  );
  const dogfood = await readFile(
    new URL('../skills/tododdle-factory/references/staging-dogfood.md', import.meta.url),
    'utf8'
  );

  assert.match(skill, /only when the user explicitly asks for a factory run or autonomous delivery/);
  assert.match(skill, /Use tododdle-workflow for ordinary ledger updates/);
  assert.match(skill, /\.\.\/tododdle-workflow\/SKILL\.md/);
  assert.match(skill, /unique opaque run ID/);
  assert.match(skill, /claim_ticket/);
  assert.match(skill, /renew_ticket_claim/);
  assert.match(skill, /finish_agent_run/);
  assert.match(skill, /stable evidence/);
  assert.match(skill, /Never approve your own work/);
  assert.match(skill, /finish the run as `FAILED`/);
  assert.match(skill, /call `release_ticket`/);
  assert.match(skill, /Confirm the claim is released/);
  assert.match(skill, /Remove only temporary files created by the run/);
  assert.match(skill, /Never silently complete, close, reject, move, or archive/);
  assert.match(metadata, /value: "tododdle"/);
  assert.match(metadata, /\$tododdle-factory/);
  assert.match(metadata, /allow_implicit_invocation: true/);
  assert.match(dogfood, /non-critical staging Ticket/);
  assert.match(dogfood, /Exercise one safe stop/);
  assert.match(dogfood, /terminal result releases the claim/);
  assert.match(dogfood, /Do not publish when any check fails/);
});

test('suggested AGENTS rules require concise, human ticket writing', async () => {
  const agents = await readFile(new URL('../examples/AGENTS.tododdle.md', import.meta.url), 'utf8');

  assert.match(agents, /ticket titles, ticket descriptions, comments, status updates, handoffs/);
  assert.match(agents, /ASD-STE100 Simplified Technical English/);
  assert.match(agents, /simplicity, brevity, clarity, and humanity/);
  assert.match(agents, /readable Markdown/);
  assert.match(agents, /Claim the known ticket with `claim_ticket` before substantial implementation/);
  assert.match(agents, /Renew the claim before its lease expires/);
  assert.match(agents, /release it when work stops, completes, or is handed off/);
  assert.match(agents, /Respect another active claim/);
});

test('README documents bounded and compaction-safe context loading', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /Bounded Project Context/);
  assert.match(readme, /get_project_brief` only/);
  assert.match(readme, /get_project_context` once/);
  assert.match(readme, /summary-only Context records/);
  assert.match(readme, /Summaries are limited to 500 characters/);
  assert.match(readme, /follow their pagination metadata/);
  assert.match(readme, /compaction summary/);
  assert.match(readme, /Refresh only volatile ticket state/);
  assert.match(readme, /Context artifacts can form a tree/);
  assert.match(readme, /Supply `parentArtifactId` when creating or updating a child artifact/);
  assert.match(readme, /hierarchy cycles/);
  assert.match(readme, /Simple lookups should skip the brief and full context entirely/);
});

test('README documents opt-in scheduled workflow recipes', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /Scheduled ToDoddle Workflows/);
  assert.match(readme, /Installing the plugin never creates a schedule/);
  assert.match(readme, /confirm the timezone, project, cadence, and allowed mutation level/);
  assert.match(readme, /server-owned queue or cron system/);
});

test('README documents separate Claude Code MCP and workflow plugin setup', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /\/plugin marketplace add krffl\/tododdle-mcp/);
  assert.match(readme, /\/plugin install tododdle@tododdle/);
  assert.match(readme, /Keep the existing ToDoddle MCP connection/);
  assert.match(readme, /does not start another MCP server/);
  assert.match(readme, /claim substantial ticket work/);
});
