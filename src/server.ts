import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToDoddleApi } from './api-client.js';
import { prepareUploadSource } from './upload-source.js';

const packageVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

const statusSchema = z.enum([
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'COMPLETE',
  'REJECTED',
  'NEED_MORE_INFO',
  'CANNOT_REPLICATE',
]);
const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const taskKindSchema = z.enum(['TASK', 'FEATURE', 'EPIC', 'BUG', 'RESEARCH', 'ACTION_ITEM']);
const artifactTypeSchema = z.enum([
  'BRIEF',
  'SPEC',
  'PROPOSAL',
  'DECISION',
  'PROCESS',
  'RESEARCH',
  'MEETING_PACKET',
  'RETROSPECTIVE',
]);
const artifactStatusSchema = z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED', 'ARCHIVED']);
const commentKindSchema = z.enum([
  'DISCUSSION',
  'STATUS_UPDATE',
  'QUESTION',
  'DECISION',
  'HANDOFF',
]);
const focusBucketSchema = z.enum(['TODAY', 'NEXT', 'LATER']);
const projectStatusSchema = z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']);
const sectionEntryActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SET_STATUS'), status: statusSchema }),
  z.object({ type: z.literal('SET_PRIORITY'), priority: prioritySchema }),
  z.object({ type: z.literal('SET_KIND'), kind: taskKindSchema }),
  z.object({ type: z.literal('SET_ASSIGNEE'), assigneeId: z.string().min(1).nullable() }),
  z.object({ type: z.literal('ARCHIVE_TASK') }),
]);
const artifactRelationTypeSchema = z.enum(['RELATED_TO', 'SUPERSEDES', 'IMPLEMENTS', 'SUPPORTS']);
const expectedUpdatedAtSchema = z
  .string()
  .datetime({ offset: true })
  .describe('updatedAt from the latest read of this resource');

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export interface ToDoddleMcpServerOptions {
  uploadRoots?: string[];
  maxUploadBytes?: number;
}

interface UploadSession {
  documentId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

function readUploadSession(value: Record<string, unknown>): UploadSession {
  const session = value.session;
  if (!session || typeof session !== 'object') throw new Error('Upload API returned no session');
  const record = session as Record<string, unknown>;
  if (
    typeof record.documentId !== 'string' ||
    typeof record.uploadUrl !== 'string' ||
    !record.headers ||
    typeof record.headers !== 'object'
  ) {
    throw new Error('Upload API returned an invalid session');
  }
  return {
    documentId: record.documentId,
    uploadUrl: record.uploadUrl,
    headers: Object.fromEntries(
      Object.entries(record.headers as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    ),
  };
}

const uploadInputBaseSchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1).optional(),
  sourceUrl: z.string().url().optional(),
  fileName: z.string().min(1).max(255).optional(),
  contentType: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  folderId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).optional(),
});
const uploadInputSchema = uploadInputBaseSchema.refine(
  (value) => Boolean(value.filePath) !== Boolean(value.sourceUrl),
  {
    message: 'Provide exactly one of filePath or sourceUrl',
  }
);
const taskUploadInputSchema = uploadInputBaseSchema
  .extend({ taskId: z.string().min(1) })
  .refine((value) => Boolean(value.filePath) !== Boolean(value.sourceUrl), {
    message: 'Provide exactly one of filePath or sourceUrl',
  });

async function uploadDocument(
  api: ToDoddleApi,
  options: Required<ToDoddleMcpServerOptions>,
  input: z.infer<typeof uploadInputBaseSchema> & { taskId?: string }
) {
  const prepared = await prepareUploadSource(input, options.uploadRoots, options.maxUploadBytes);
  let session: UploadSession | null = null;
  let bytesUploaded = false;
  const idempotencyKey = input.idempotencyKey || randomUUID();
  try {
    session = readUploadSession(
      await api.post(
        `/api/external/projects/${input.projectId}/documents/upload-sessions`,
        {
          fileName: prepared.fileName,
          fileSize: prepared.fileSize,
          contentType: prepared.contentType,
          description: input.description,
          folderId: input.folderId,
          creationSource: input.taskId ? 'TASK_ATTACHMENT' : 'UPLOAD',
        },
        idempotencyKey
      )
    );
    await api.uploadFile(session.uploadUrl, session.headers, prepared.filePath, prepared.fileSize);
    bytesUploaded = true;
    return await api.post(
      `/api/external/projects/${input.projectId}/documents/${session.documentId}/finalize`,
      { success: true, taskId: input.taskId },
      `${idempotencyKey}-finalize`
    );
  } catch (error) {
    if (session && !bytesUploaded) {
      await api
        .post(
          `/api/external/projects/${input.projectId}/documents/${session.documentId}/finalize`,
          { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
          `${idempotencyKey}-failure`
        )
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await prepared.cleanup();
  }
}

export function createToDoddleMcpServer(
  api: ToDoddleApi,
  serverOptions: ToDoddleMcpServerOptions = {}
): McpServer {
  const options: Required<ToDoddleMcpServerOptions> = {
    uploadRoots: serverOptions.uploadRoots ?? [],
    maxUploadBytes: serverOptions.maxUploadBytes ?? 1024 * 1024 * 1024,
  };
  const server = new McpServer({ name: 'tododdle', version: packageVersion.version });

  server.registerTool(
    'list_projects',
    {
      description: 'List projects accessible through this Agent Connection.',
      inputSchema: z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(await api.get('/api/external/projects', input))
  );

  server.registerTool(
    'get_project',
    {
      description: 'Get one accessible project and its current update timestamp.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => toolResult(await api.get(`/api/external/projects/${projectId}`))
  );

  server.registerTool(
    'create_project',
    {
      description: 'Create a project in the Agent Connection organization.',
      inputSchema: z.object({
        name: z.string().min(1).max(500),
        description: z.string().max(50_000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ idempotencyKey, ...body }) =>
      toolResult(await api.post('/api/external/projects', body, idempotencyKey))
  );

  server.registerTool(
    'update_project',
    {
      description: 'Update project details using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        name: z.string().min(1).max(500).optional(),
        description: z.string().max(50_000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        status: projectStatusSchema.optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...body }) =>
      toolResult(await api.put(`/api/external/projects/${projectId}`, body))
  );

  for (const [name, archived, description, destructiveHint] of [
    [
      'archive_project',
      true,
      'Archive a project without deleting its tasks. Requires explicit approval.',
      true,
    ],
    ['restore_project', false, 'Restore an archived project.', false],
  ] as const) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: z.object({
          projectId: z.string().min(1),
          expectedUpdatedAt: expectedUpdatedAtSchema,
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ projectId, expectedUpdatedAt }) =>
        toolResult(
          await api.put(`/api/external/projects/${projectId}`, { archived, expectedUpdatedAt })
        )
    );
  }

  server.registerTool(
    'list_plans',
    {
      description: 'List bounded active or archived plans in a project.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        search: z.string().optional(),
        includeArchived: z.boolean().default(false),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...query }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/plans`, query))
  );

  server.registerTool(
    'get_plan',
    {
      description: 'Get one plan in a project.',
      inputSchema: z.object({ projectId: z.string().min(1), planId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/plans/${planId}`))
  );

  server.registerTool(
    'create_plan',
    {
      description: 'Create a plan in a project.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        name: z.string().min(1).max(500),
        description: z.string().max(50_000).nullable().optional(),
        startDate: z.string().datetime({ offset: true }).nullable().optional(),
        endDate: z.string().datetime({ offset: true }).nullable().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, idempotencyKey, ...body }) =>
      toolResult(await api.post(`/api/external/projects/${projectId}/plans`, body, idempotencyKey))
  );

  server.registerTool(
    'update_plan',
    {
      description: 'Update plan details using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        name: z.string().min(1).max(500).optional(),
        description: z.string().max(50_000).nullable().optional(),
        startDate: z.string().datetime({ offset: true }).nullable().optional(),
        endDate: z.string().datetime({ offset: true }).nullable().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, ...body }) =>
      toolResult(await api.put(`/api/external/projects/${projectId}/plans/${planId}`, body))
  );

  server.registerTool(
    'move_plan',
    {
      description: 'Reorder a plan within its project using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        position: z.number().int().min(0),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, ...body }) =>
      toolResult(await api.put(`/api/external/projects/${projectId}/plans/${planId}`, body))
  );

  for (const [name, archived, description, destructiveHint] of [
    [
      'archive_plan',
      true,
      'Archive a plan without changing its tasks. Requires explicit approval.',
      true,
    ],
    ['restore_plan', false, 'Restore an archived plan.', false],
  ] as const) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: z.object({
          projectId: z.string().min(1),
          planId: z.string().min(1),
          expectedUpdatedAt: expectedUpdatedAtSchema,
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ projectId, planId, expectedUpdatedAt }) =>
        toolResult(
          await api.put(`/api/external/projects/${projectId}/plans/${planId}`, {
            archived,
            expectedUpdatedAt,
          })
        )
    );
  }

  server.registerTool(
    'list_sections',
    {
      description: 'List bounded sections and entry automations in a plan.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        search: z.string().optional(),
        includeArchived: z.boolean().default(false),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, ...query }) =>
      toolResult(
        await api.get(`/api/external/projects/${projectId}/plans/${planId}/sections`, query)
      )
  );

  server.registerTool(
    'get_section',
    {
      description: 'Get one plan section and its entry automations.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        sectionId: z.string().min(1),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, sectionId }) =>
      toolResult(
        await api.get(`/api/external/projects/${projectId}/plans/${planId}/sections/${sectionId}`)
      )
  );

  server.registerTool(
    'create_section',
    {
      description: 'Create a section with optional typed entry automations.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        name: z.string().min(1).max(500),
        description: z.string().max(50_000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        entryActions: z.array(sectionEntryActionSchema).max(5).optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/plans/${planId}/sections`,
          body,
          idempotencyKey
        )
      )
  );

  server.registerTool(
    'update_section',
    {
      description: 'Update a section and its entry automations using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        sectionId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        name: z.string().min(1).max(500).optional(),
        description: z.string().max(50_000).nullable().optional(),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
        entryActions: z.array(sectionEntryActionSchema).max(5).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, sectionId, ...body }) =>
      toolResult(
        await api.put(
          `/api/external/projects/${projectId}/plans/${planId}/sections/${sectionId}`,
          body
        )
      )
  );

  server.registerTool(
    'move_section',
    {
      description: 'Reorder a section within its plan using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        sectionId: z.string().min(1),
        position: z.number().int().min(0),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, planId, sectionId, ...body }) =>
      toolResult(
        await api.put(
          `/api/external/projects/${projectId}/plans/${planId}/sections/${sectionId}`,
          body
        )
      )
  );

  for (const [name, archived, description, destructiveHint] of [
    [
      'archive_section',
      true,
      'Archive a section without changing its tasks. Requires explicit approval.',
      true,
    ],
    ['restore_section', false, 'Restore an archived section.', false],
  ] as const) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: z.object({
          projectId: z.string().min(1),
          planId: z.string().min(1),
          sectionId: z.string().min(1),
          expectedUpdatedAt: expectedUpdatedAtSchema,
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ projectId, planId, sectionId, expectedUpdatedAt }) =>
        toolResult(
          await api.put(
            `/api/external/projects/${projectId}/plans/${planId}/sections/${sectionId}`,
            { archived, expectedUpdatedAt }
          )
        )
    );
  }

  server.registerTool(
    'list_project_members',
    {
      description: 'List bounded project member summaries for assignee and owner selection.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...query }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/members`, query))
  );

  server.registerTool(
    'list_project_documents',
    {
      description: 'List bounded document metadata for a project.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        search: z.string().optional(),
        folderId: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...query }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/documents`, query))
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List bounded organization Notes. Project-only connections cannot access Notes.',
      inputSchema: z.object({
        search: z.string().optional(),
        parentId: z.string().nullable().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ parentId, ...query }) =>
      toolResult(
        await api.get('/api/external/notes', {
          ...query,
          parentId: parentId ?? undefined,
        })
      )
  );

  server.registerTool(
    'get_note',
    {
      description: 'Get one organization Note.',
      inputSchema: z.object({ noteId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ noteId }) => toolResult(await api.get(`/api/external/notes/${noteId}`))
  );

  server.registerTool(
    'create_note',
    {
      description: 'Create an organization Note.',
      inputSchema: z.object({
        title: z.string().min(1).max(500),
        content: z.string().max(200_000).default(''),
        parentId: z.string().nullable().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ idempotencyKey, ...body }) =>
      toolResult(await api.post('/api/external/notes', body, idempotencyKey))
  );

  server.registerTool(
    'update_note',
    {
      description: 'Update an organization Note using optimistic concurrency.',
      inputSchema: z.object({
        noteId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        title: z.string().min(1).max(500).optional(),
        content: z.string().max(200_000).optional(),
        parentId: z.string().nullable().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ noteId, ...body }) => toolResult(await api.put(`/api/external/notes/${noteId}`, body))
  );

  server.registerTool(
    'archive_note',
    {
      description: 'Archive an organization Note. Requires explicit approval.',
      inputSchema: z.object({
        noteId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ noteId, expectedUpdatedAt }) =>
      toolResult(await api.delete(`/api/external/notes/${noteId}`, { expectedUpdatedAt }))
  );

  server.registerTool(
    'get_project_context',
    {
      description: 'Get bounded project-plan and section context for task planning.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/context`))
  );

  server.registerTool(
    'upload_project_document',
    {
      description:
        'Upload an approved local file or HTTPS URL to a project document library. Local paths must be inside TODODDLE_UPLOAD_ROOTS.',
      inputSchema: uploadInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => toolResult(await uploadDocument(api, options, input))
  );

  server.registerTool(
    'attach_file_to_task',
    {
      description:
        'Upload an approved local file or HTTPS URL and attach it to a task in the same project.',
      inputSchema: taskUploadInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => toolResult(await uploadDocument(api, options, input))
  );

  server.registerTool(
    'get_work_queue',
    {
      description:
        'Get active, overdue, or unassigned work with optional project, status, and search filters.',
      inputSchema: z.object({
        view: z.enum(['tasks', 'overdue', 'unassigned']).default('tasks'),
        projectId: z.string().optional(),
        status: statusSchema.optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().datetime({ offset: true }).optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(await api.get('/api/external/work-queue', input))
  );

  server.registerTool(
    'get_focus_list',
    {
      description: 'List the current user’s deliberately curated Focus tasks.',
      inputSchema: z.object({
        projectId: z.string().optional(),
        status: statusSchema.optional(),
        search: z.string().optional(),
        bucket: focusBucketSchema.optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(await api.get('/api/external/focus', input))
  );

  server.registerTool(
    'add_task_to_focus',
    {
      description: 'Add an accessible active task to Focus. Repeated additions are idempotent.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        bucket: focusBucketSchema.default('NEXT'),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ idempotencyKey, ...body }) =>
      toolResult(await api.post('/api/external/focus', body, idempotencyKey || randomUUID()))
  );

  server.registerTool(
    'move_focus_task',
    {
      description: 'Move or reorder a Focus task using optimistic concurrency.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        bucket: focusBucketSchema,
        position: z.number().int().min(0),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) =>
      toolResult(await api.patch(`/api/external/focus/${taskId}`, body))
  );

  server.registerTool(
    'remove_task_from_focus',
    {
      description: 'Remove personal Focus metadata without changing the underlying task.',
      inputSchema: z.object({ taskId: z.string().min(1) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId }) => toolResult(await api.delete(`/api/external/focus/${taskId}`, {}))
  );

  server.registerTool(
    'list_tasks',
    {
      description:
        'List bounded tasks with optional project, plan, section, assignee, status, priority, search, and archive filters.',
      inputSchema: z.object({
        projectId: z.string().min(1).optional(),
        planId: z.string().min(1).optional(),
        sectionId: z.string().min(1).optional(),
        assigneeId: z.string().min(1).optional(),
        status: statusSchema.optional(),
        priority: prioritySchema.optional(),
        search: z.string().optional(),
        includeArchived: z.boolean().default(false),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(await api.get('/api/external/tasks', input))
  );

  server.registerTool(
    'get_task',
    {
      description: 'Get complete task context including comments and blocker information.',
      inputSchema: z.object({ taskId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId }) => toolResult(await api.get(`/api/external/tasks/${taskId}`))
  );

  server.registerTool(
    'create_task',
    {
      description: 'Create a task in an active project plan section.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        planId: z.string().min(1),
        sectionId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: prioritySchema.optional(),
        dueDate: z.string().datetime({ offset: true }).optional(),
        assigneeId: z.string().optional(),
        blockedByTaskId: z.string().optional(),
        kind: taskKindSchema.optional(),
        parentTaskId: z.string().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ idempotencyKey, ...body }) =>
      toolResult(await api.post('/api/external/tasks', body, idempotencyKey || randomUUID()))
  );

  server.registerTool(
    'update_task',
    {
      description:
        'Update editable task fields. Requires the latest updatedAt value to prevent overwriting newer changes.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        priority: prioritySchema.optional(),
        dueDate: z.string().datetime({ offset: true }).nullable().optional(),
        assigneeId: z.string().nullable().optional(),
        kind: taskKindSchema.optional(),
        parentTaskId: z.string().nullable().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) => toolResult(await api.put(`/api/external/tasks/${taskId}`, body))
  );

  server.registerTool(
    'transition_task',
    {
      description: 'Transition a task to a canonical status.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        status: statusSchema,
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) => toolResult(await api.put(`/api/external/tasks/${taskId}`, body))
  );

  server.registerTool(
    'move_task',
    {
      description:
        'Move a task to an active section, optionally in another plan in the same project. Preview first because section actions may archive the task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        planId: z.string().min(1).optional(),
        sectionId: z.string().min(1),
        position: z.number().int().min(0),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) =>
      toolResult(await api.put(`/api/external/tasks/${taskId}/move`, body))
  );

  server.registerTool(
    'preview_task_move',
    {
      description:
        'Preview destination section actions, warnings, destructive effects, and hierarchy blockers before moving a task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        planId: z.string().min(1).optional(),
        sectionId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema.optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) =>
      toolResult(await api.post(`/api/external/tasks/${taskId}/move/preview`, body))
  );

  server.registerTool(
    'set_task_blocker',
    {
      description: 'Set or clear the active same-project task blocking this task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        blockedByTaskId: z.string().nullable(),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, ...body }) => toolResult(await api.put(`/api/external/tasks/${taskId}`, body))
  );

  server.registerTool(
    'add_task_comment',
    {
      description:
        'Add an implementation note, finding, decision, or completion evidence to a task.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        content: z.string().min(1),
        kind: commentKindSchema.default('DISCUSSION'),
        replyToCommentId: z.string().min(1).optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ taskId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/tasks/${taskId}/comments`,
          body,
          idempotencyKey || randomUUID()
        )
      )
  );

  server.registerTool(
    'get_agent_inbox',
    {
      description: 'List human or agent replies to comments created by this Agent Connection.',
      inputSchema: z.object({
        cursor: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).default(25),
        unacknowledgedOnly: z.boolean().default(true),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => toolResult(await api.get('/api/external/agent-inbox', input))
  );

  server.registerTool(
    'acknowledge_agent_reply',
    {
      description: 'Mark one inbox reply as handled by this Agent Connection.',
      inputSchema: z.object({ commentId: z.string().min(1) }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ commentId }) =>
      toolResult(await api.post(`/api/external/agent-inbox/${commentId}/acknowledge`, {}))
  );

  server.registerTool(
    'archive_task',
    {
      description:
        'Archive a task and clear dependent blocker relationships. Requires explicit human approval.',
      inputSchema: z.object({
        taskId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ taskId, expectedUpdatedAt }) =>
      toolResult(
        await api.patch(`/api/external/tasks/${taskId}/archive`, {
          archived: true,
          expectedUpdatedAt,
        })
      )
  );

  server.registerTool(
    'get_active_time_entries',
    {
      description: 'List the current user’s active timers across granted projects.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => toolResult(await api.get('/api/external/time-entries/active'))
  );

  server.registerTool(
    'list_project_time',
    {
      description: 'List bounded time entries and exact and rounded totals for a project.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        userId: z.string().optional(),
        taskId: z.string().optional(),
        startedFrom: z.string().datetime({ offset: true }).optional(),
        startedTo: z.string().datetime({ offset: true }).optional(),
        billable: z.boolean().optional(),
        invoiced: z.boolean().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...query }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/time-entries`, query))
  );

  server.registerTool(
    'list_task_time',
    {
      description: 'List bounded time entries and totals for one task.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, ...query }) =>
      toolResult(
        await api.get(`/api/external/projects/${projectId}/tasks/${taskId}/time-entries`, query)
      )
  );

  server.registerTool(
    'start_task_timer',
    {
      description:
        'Start a live timer on an active task. A task allows one active timer; different tasks may run concurrently.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        startedAt: z.string().datetime({ offset: true }).optional(),
        note: z.string().max(2000).optional(),
        billable: z.boolean().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, idempotencyKey, startedAt, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/tasks/${taskId}/time-entries`,
          { ...body, startedAt: startedAt ?? new Date().toISOString() },
          idempotencyKey || randomUUID()
        )
      )
  );

  server.registerTool(
    'stop_task_timer',
    {
      description: 'Stop an active task timer using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        timeEntryId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        endedAt: z.string().datetime({ offset: true }).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, timeEntryId, endedAt, expectedUpdatedAt }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/tasks/${taskId}/time-entries/${timeEntryId}/stop`,
          { endedAt: endedAt ?? new Date().toISOString(), expectedUpdatedAt }
        )
      )
  );

  server.registerTool(
    'log_task_time',
    {
      description: 'Log a completed historical interval against a task.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        startedAt: z.string().datetime({ offset: true }),
        endedAt: z.string().datetime({ offset: true }),
        note: z.string().max(2000).optional(),
        billable: z.boolean().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/tasks/${taskId}/time-entries`,
          body,
          idempotencyKey || randomUUID()
        )
      )
  );

  server.registerTool(
    'update_time_entry',
    {
      description: 'Correct a time interval, note, or billable flag using optimistic concurrency.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        timeEntryId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
        startedAt: z.string().datetime({ offset: true }).optional(),
        endedAt: z.string().datetime({ offset: true }).nullable().optional(),
        note: z.string().max(2000).nullable().optional(),
        billable: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, timeEntryId, ...body }) =>
      toolResult(
        await api.patch(
          `/api/external/projects/${projectId}/tasks/${taskId}/time-entries/${timeEntryId}`,
          body
        )
      )
  );

  server.registerTool(
    'archive_time_entry',
    {
      description: 'Archive an incorrect time entry. Requires explicit human approval.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        taskId: z.string().min(1),
        timeEntryId: z.string().min(1),
        expectedUpdatedAt: expectedUpdatedAtSchema,
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, taskId, timeEntryId, expectedUpdatedAt }) =>
      toolResult(
        await api.delete(
          `/api/external/projects/${projectId}/tasks/${taskId}/time-entries/${timeEntryId}`,
          { expectedUpdatedAt }
        )
      )
  );

  server.registerTool(
    'get_project_brief',
    {
      description: 'Read the canonical project brief before planning or changing work.',
      inputSchema: z.object({ projectId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId }) => toolResult(await api.get(`/api/external/projects/${projectId}/brief`))
  );

  server.registerTool(
    'list_project_artifacts',
    {
      description:
        'List bounded project specifications, decisions, proposals, research, processes, and meeting context.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        search: z.string().optional(),
        type: artifactTypeSchema.optional(),
        status: artifactStatusSchema.optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, ...query }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/artifacts`, query))
  );

  server.registerTool(
    'get_project_artifact',
    {
      description:
        'Get complete Markdown, relationships, comments, and task links for one project artifact.',
      inputSchema: z.object({ projectId: z.string().min(1), artifactId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId }) =>
      toolResult(await api.get(`/api/external/projects/${projectId}/artifacts/${artifactId}`))
  );

  server.registerTool(
    'create_project_artifact',
    {
      description: 'Create a typed Markdown artifact in a project. PRDs use the SPEC type.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        type: artifactTypeSchema,
        title: z.string().min(1),
        summary: z.string().nullable().optional(),
        content: z.string().optional(),
        ownerId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        changeNote: z.string().optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/artifacts`,
          body,
          idempotencyKey || randomUUID()
        )
      )
  );

  server.registerTool(
    'list_artifact_revisions',
    {
      description: 'List the bounded immutable revision history for a project artifact.',
      inputSchema: z.object({ projectId: z.string().min(1), artifactId: z.string().min(1) }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId }) =>
      toolResult(
        await api.get(`/api/external/projects/${projectId}/artifacts/${artifactId}/revisions`)
      )
  );

  server.registerTool(
    'link_project_artifacts',
    {
      description: 'Create a typed same-project relationship between two context artifacts.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        artifactId: z.string().min(1),
        targetArtifactId: z.string().min(1),
        type: artifactRelationTypeSchema.default('RELATED_TO'),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/artifacts/${artifactId}/relations`,
          body,
          idempotencyKey
        )
      )
  );

  server.registerTool(
    'update_project_artifact',
    {
      description:
        'Update artifact Markdown or metadata using optimistic concurrency. Editing approved content returns it to draft.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        artifactId: z.string().min(1),
        expectedUpdatedAt: z.string().datetime({ offset: true }),
        title: z.string().min(1).optional(),
        summary: z.string().nullable().optional(),
        content: z.string().optional(),
        ownerId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        changeNote: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId, ...body }) =>
      toolResult(
        await api.patch(`/api/external/projects/${projectId}/artifacts/${artifactId}`, body)
      )
  );

  server.registerTool(
    'transition_project_artifact',
    {
      description: 'Submit, approve, supersede, archive, or return a project artifact to draft.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        artifactId: z.string().min(1),
        status: artifactStatusSchema,
        expectedUpdatedAt: z.string().datetime({ offset: true }),
        changeNote: z.string().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/artifacts/${artifactId}/transition`,
          body
        )
      )
  );

  server.registerTool(
    'link_artifact_task',
    {
      description:
        'Link same-project execution work to the context it implements, informs, evidences, or came from.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        artifactId: z.string().min(1),
        taskId: z.string().min(1),
        type: z
          .enum(['RELATED', 'IMPLEMENTS', 'INFORMS', 'EVIDENCE', 'ACTION_FROM'])
          .default('RELATED'),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/artifacts/${artifactId}/task-links`,
          body,
          idempotencyKey
        )
      )
  );

  server.registerTool(
    'add_artifact_comment',
    {
      description:
        'Add or reply to a typed comment on project context. Attachments are not supported.',
      inputSchema: z.object({
        projectId: z.string().min(1),
        artifactId: z.string().min(1),
        content: z.string().min(1),
        kind: commentKindSchema.default('DISCUSSION'),
        replyToCommentId: z.string().min(1).optional(),
        idempotencyKey: z.string().min(8).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ projectId, artifactId, idempotencyKey, ...body }) =>
      toolResult(
        await api.post(
          `/api/external/projects/${projectId}/artifacts/${artifactId}/comments`,
          body,
          idempotencyKey || randomUUID()
        )
      )
  );

  server.registerResource(
    'task',
    new ResourceTemplate('tododdle://tasks/{taskId}', { list: undefined }),
    {
      title: 'ToDoddle task',
      description: 'Complete task context by ID.',
      mimeType: 'application/json',
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            await api.get(`/api/external/tasks/${String(variables.taskId)}`),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    'project',
    new ResourceTemplate('tododdle://projects/{projectId}', { list: undefined }),
    {
      title: 'ToDoddle project context',
      description: 'Bounded project-plan and section context by project ID.',
      mimeType: 'application/json',
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            await api.get(`/api/external/projects/${String(variables.projectId)}/context`),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    'project-artifact',
    new ResourceTemplate('tododdle://projects/{projectId}/artifacts/{artifactId}', {
      list: undefined,
    }),
    {
      title: 'ToDoddle project artifact',
      description: 'Complete project context artifact by project and artifact ID.',
      mimeType: 'application/json',
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            await api.get(
              `/api/external/projects/${String(variables.projectId)}/artifacts/${String(variables.artifactId)}`
            ),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerPrompt(
    'triage_work',
    {
      description: 'Review active work and identify the most important next actions.',
      argsSchema: { projectId: z.string().optional() },
    },
    ({ projectId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${projectId ? `Read get_project_context for project ${projectId}, then ` : ''}use get_work_queue${projectId ? ` for that project` : ''}. Identify overdue, blocked, and unassigned tasks in light of project intent. Propose updates before making destructive changes.`,
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'daily_status',
    {
      description: 'Summarize current work state for a human review.',
      argsSchema: { projectId: z.string().optional() },
    },
    ({ projectId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${projectId ? `Read get_project_context for project ${projectId}. ` : ''}Review current, overdue, and recently updated work${projectId ? ' for that project' : ''}. Summarize progress against intended outcomes, blockers, risks, decisions, and next actions with task links.`,
          },
        },
      ],
    })
  );

  return server;
}
