#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const START_MARKER = '<!-- tododdle:start -->';
export const END_MARKER = '<!-- tododdle:end -->';

const usage = `Usage: update-agents.mjs --agents-file <path> --project-id <id> --project-name <name> [--dry-run]`;

const countOccurrences = (content, value) => content.split(value).length - 1;

const validateSingleLine = (value, label, pattern) => {
  if (!value || value.includes('\n') || value.includes('\r') || !pattern.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
};

export const buildManagedBlock = ({ projectId, projectName, eol = '\n' }) => {
  validateSingleLine(projectId, 'project ID', /^[A-Za-z0-9_-]{1,128}$/);
  validateSingleLine(projectName, 'project name', /^[^<>`]{1,200}$/);

  return [
    START_MARKER,
    '## ToDoddle Work Ledger',
    '',
    `Use \`$tododdle-workflow\` and the \`tododdle\` MCP server for work tracked in ToDoddle project \`${projectId}\` (${projectName}).`,
    '',
    'Before substantial work:',
    '',
    '- Read the project brief and relevant Context.',
    '- Find the existing ticket before creating another.',
    '- Claim the ticket before implementation.',
    '- Keep its status, assignee, lane, priority, due date, parent, and blockers current.',
    '- Add one concise handoff with verification evidence.',
    '- Finish the Agent Run when work succeeds. Release the claim when work stops without a terminal result.',
    '',
    'If ToDoddle access is missing, report the exact missing server, scope, or project grant. Do not claim that a ledger update succeeded.',
    END_MARKER,
  ].join(eol);
};

export const updateAgentsContent = (content, options) => {
  const startCount = countOccurrences(content, START_MARKER);
  const endCount = countOccurrences(content, END_MARKER);

  if (startCount !== endCount || startCount > 1) {
    throw new Error('Malformed ToDoddle markers. Expected zero or one matched marker pair.');
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const block = buildManagedBlock({ ...options, eol });

  if (startCount === 1) {
    const start = content.indexOf(START_MARKER);
    const endMarkerStart = content.indexOf(END_MARKER, start);
    if (endMarkerStart === -1) {
      throw new Error('Malformed ToDoddle markers. The end marker must follow the start marker.');
    }
    const end = endMarkerStart + END_MARKER.length;
    const updatedContent = `${content.slice(0, start)}${block}${content.slice(end)}`;
    return {
      content: updatedContent,
      action: updatedContent === content ? 'unchanged' : 'updated',
    };
  }

  if (!content) {
    return { content: `${block}${eol}`, action: 'created' };
  }

  const separator = content.endsWith(eol) ? eol : `${eol}${eol}`;
  return { content: `${content}${separator}${block}${eol}`, action: 'updated' };
};

export const parseArgs = (args) => {
  const options = { dryRun: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (!['--agents-file', '--project-id', '--project-name'].includes(argument)) {
      throw new Error(`${usage}\nUnknown argument: ${argument}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${usage}\nMissing value for ${argument}.`);
    }

    const key = {
      '--agents-file': 'agentsFile',
      '--project-id': 'projectId',
      '--project-name': 'projectName',
    }[argument];
    options[key] = value;
    index += 1;
  }

  if (!options.agentsFile || !options.projectId || !options.projectName) {
    throw new Error(usage);
  }

  return options;
};

export const applyAgentsUpdate = async ({ agentsFile, projectId, projectName, dryRun = false }) => {
  const resolvedFile = path.resolve(agentsFile);
  if (!['AGENTS.md', 'AGENTS.override.md'].includes(path.basename(resolvedFile))) {
    throw new Error('The target must be AGENTS.md or AGENTS.override.md.');
  }

  let original = '';
  try {
    await access(resolvedFile);
    original = await readFile(resolvedFile, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }

  const result = updateAgentsContent(original, { projectId, projectName });
  if (!dryRun && result.action !== 'unchanged') {
    await writeFile(resolvedFile, result.content, 'utf8');
  }

  return { ...result, file: resolvedFile, dryRun };
};

export const main = async (args = process.argv.slice(2)) => {
  const result = await applyAgentsUpdate(parseArgs(args));
  const prefix = result.dryRun ? 'Would be' : 'Is';
  process.stdout.write(`${prefix} ${result.action}: ${result.file}\n`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
