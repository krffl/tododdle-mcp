import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient } from '../api/client.js';
import { Todo, CreateTodoRequest } from '../api/types.js';

// List Todos
const ListTodosSchema = z.object({
  projectId: z.string().optional(),
});

export const listTodosTool: Tool = {
  name: 'list_todos',
  description: "List user's todo items",
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project ID',
      },
    },
  },
};

export async function executeListTodos(args: unknown) {
  const params = ListTodosSchema.parse(args);

  const queryParams = new URLSearchParams();
  if (params.projectId) queryParams.set('projectId', params.projectId);

  const response = await apiClient.get<Todo[] | { data: Todo[] }>(
    `/api/external/todos?${queryParams}`
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

// Add Todo
const AddTodoSchema = z.object({
  taskId: z.string(),
});

export const addTodoTool: Tool = {
  name: 'add_todo',
  description: "Add a task to user's todo list",
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to add to todo list',
      },
    },
    required: ['taskId'],
  },
};

export async function executeAddTodo(args: unknown) {
  const params = AddTodoSchema.parse(args);
  const request: CreateTodoRequest = {
    taskId: params.taskId,
  };
  const response = await apiClient.post<Todo>('/api/external/todos', request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Remove Todo
const RemoveTodoSchema = z.object({
  taskId: z.string(),
});

export const removeTodoTool: Tool = {
  name: 'remove_todo',
  description: "Remove a task from user's todo list",
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID to remove from todo list',
      },
    },
    required: ['taskId'],
  },
};

export async function executeRemoveTodo(args: unknown) {
  const params = RemoveTodoSchema.parse(args);
  await apiClient.delete(`/api/external/todos/${params.taskId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: 'Todo removed successfully' }, null, 2),
      },
    ],
  };
}
