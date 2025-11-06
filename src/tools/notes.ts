import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient } from '../api/client.js';
import { Note, CreateNoteRequest, UpdateNoteRequest } from '../api/types.js';

// List Notes
const ListNotesSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const listNotesTool: Tool = {
  name: 'list_notes',
  description: 'List notes in an organization',
  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Search query',
      },
      parentId: {
        type: 'string',
        description: 'Filter by parent note ID',
      },
      page: {
        type: 'number',
        description: 'Page number for pagination',
      },
      limit: {
        type: 'number',
        description: 'Number of items per page',
      },
    },
  },
};

export async function executeListNotes(args: unknown) {
  const params = ListNotesSchema.parse(args);

  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);
  if (params.parentId) queryParams.set('parentId', params.parentId);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const response = await apiClient.get<Note[] | { data: Note[] }>(
    `/api/external/notes?${queryParams}`
  );

  const data = Array.isArray(response.data) ? response.data : response.data.data || [];
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

// Get Note
const GetNoteSchema = z.object({
  noteId: z.string(),
});

export const getNoteTool: Tool = {
  name: 'get_note',
  description: 'Get details of a specific note',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: 'Note ID',
      },
    },
    required: ['noteId'],
  },
};

export async function executeGetNote(args: unknown) {
  const params = GetNoteSchema.parse(args);
  const response = await apiClient.get<Note>(`/api/external/notes/${params.noteId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Create Note
const CreateNoteSchema = z.object({
  title: z.string(),
  content: z.string().optional(),
  parentId: z.string().optional(),
});

export const createNoteTool: Tool = {
  name: 'create_note',
  description: 'Create a new note',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Note title',
      },
      content: {
        type: 'string',
        description: 'Note content',
      },
      parentId: {
        type: 'string',
        description: 'Parent note ID (for hierarchical notes)',
      },
    },
    required: ['title'],
  },
};

export async function executeCreateNote(args: unknown) {
  const params = CreateNoteSchema.parse(args);
  const request: CreateNoteRequest = {
    title: params.title,
    content: params.content,
    parentId: params.parentId,
  };
  const response = await apiClient.post<Note>('/api/external/notes', request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Update Note
const UpdateNoteSchema = z.object({
  noteId: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
});

export const updateNoteTool: Tool = {
  name: 'update_note',
  description: 'Update an existing note',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: 'Note ID',
      },
      title: {
        type: 'string',
        description: 'New note title',
      },
      content: {
        type: 'string',
        description: 'New note content',
      },
    },
    required: ['noteId'],
  },
};

export async function executeUpdateNote(args: unknown) {
  const params = UpdateNoteSchema.parse(args);
  const request: UpdateNoteRequest = {};
  if (params.title !== undefined) request.title = params.title;
  if (params.content !== undefined) request.content = params.content;

  const response = await apiClient.put<Note>(`/api/external/notes/${params.noteId}`, request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Delete Note
const DeleteNoteSchema = z.object({
  noteId: z.string(),
});

export const deleteNoteTool: Tool = {
  name: 'delete_note',
  description: 'Delete a note',
  inputSchema: {
    type: 'object',
    properties: {
      noteId: {
        type: 'string',
        description: 'Note ID',
      },
    },
    required: ['noteId'],
  },
};

export async function executeDeleteNote(args: unknown) {
  const params = DeleteNoteSchema.parse(args);
  await apiClient.delete(`/api/external/notes/${params.noteId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: 'Note deleted successfully' }, null, 2),
      },
    ],
  };
}
