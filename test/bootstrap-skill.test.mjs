import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  END_MARKER,
  START_MARKER,
  applyAgentsUpdate,
  updateAgentsContent,
} from '../skills/tododdle-bootstrap/scripts/update-agents.mjs';

const project = { projectId: 'eTPg74ysbg', projectName: 'ToDoddle' };

test('creates a managed block for an empty instruction file', () => {
  const result = updateAgentsContent('', project);

  assert.equal(result.action, 'created');
  assert.match(result.content, /Use `\$tododdle-workflow`/);
  assert.match(result.content, /project `eTPg74ysbg` \(ToDoddle\)/);
  assert.equal(result.content.split(START_MARKER).length - 1, 1);
  assert.equal(result.content.split(END_MARKER).length - 1, 1);
});

test('updates only the existing managed block', () => {
  const initial = [
    '# Existing policy',
    '',
    'Keep this text.',
    '',
    START_MARKER,
    'old block',
    END_MARKER,
    '',
    'Keep this footer.',
    '',
  ].join('\n');

  const result = updateAgentsContent(initial, project);

  assert.equal(result.action, 'updated');
  assert.ok(result.content.startsWith('# Existing policy\n\nKeep this text.\n\n'));
  assert.ok(result.content.endsWith('\n\nKeep this footer.\n'));
  assert.doesNotMatch(result.content, /old block/);
});

test('is idempotent after the managed block is current', () => {
  const first = updateAgentsContent('# Existing\n', project);
  const second = updateAgentsContent(first.content, project);

  assert.equal(second.action, 'unchanged');
  assert.equal(second.content, first.content);
});

test('preserves CRLF line endings', () => {
  const result = updateAgentsContent('# Existing\r\n', project);

  assert.match(result.content, /# Existing\r\n\r\n<!-- tododdle:start -->\r\n/);
  assert.equal(result.content.replaceAll('\r\n', '').includes('\n'), false);
});

test('rejects unmatched and duplicate markers', () => {
  assert.throws(
    () => updateAgentsContent(`${START_MARKER}\n`, project),
    /Malformed ToDoddle markers/
  );
  assert.throws(
    () =>
      updateAgentsContent(
        `${START_MARKER}\n${END_MARKER}\n${START_MARKER}\n${END_MARKER}\n`,
        project
      ),
    /Malformed ToDoddle markers/
  );
  assert.throws(
    () => updateAgentsContent(`${END_MARKER}\n${START_MARKER}\n`, project),
    /end marker must follow the start marker/
  );
});

test('rejects values that could inject instructions', () => {
  assert.throws(
    () => updateAgentsContent('', { projectId: 'bad id', projectName: 'ToDoddle' }),
    /Invalid project ID/
  );
  assert.throws(
    () => updateAgentsContent('', { projectId: 'safe', projectName: 'Bad\nInstruction' }),
    /Invalid project name/
  );
  assert.throws(
    () => updateAgentsContent('', { projectId: 'safe', projectName: 'Bad `instruction`' }),
    /Invalid project name/
  );
});

test('dry run does not write the instruction file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tododdle-bootstrap-'));
  const agentsFile = path.join(directory, 'AGENTS.md');
  await writeFile(agentsFile, '# Existing\n', 'utf8');

  try {
    const result = await applyAgentsUpdate({ agentsFile, ...project, dryRun: true });

    assert.equal(result.action, 'updated');
    assert.equal(await readFile(agentsFile, 'utf8'), '# Existing\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('writes an allowed root instruction filename', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tododdle-bootstrap-'));
  const agentsFile = path.join(directory, 'AGENTS.override.md');

  try {
    const result = await applyAgentsUpdate({ agentsFile, ...project });

    assert.equal(result.action, 'created');
    assert.match(await readFile(agentsFile, 'utf8'), /project `eTPg74ysbg`/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects other target filenames', async () => {
  await assert.rejects(
    applyAgentsUpdate({ agentsFile: 'instructions.md', ...project }),
    /target must be AGENTS\.md or AGENTS\.override\.md/
  );
});
