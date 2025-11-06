import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient } from '../api/client.js';
import { Task, CreateTaskRequest, UpdateTaskRequest } from '../api/types.js';

// List Tasks
const ListTasksSchema = z.object({
  projectId: z.string().optional(),
  planId: z.string().optional(),
  status: z.string().optional(),
  assigneeId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  search: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const listTasksTool: Tool = {
  name: 'list_tasks',
  description: 'List tasks with filtering options',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Filter by project ID',
      },
      planId: {
        type: 'string',
        description: 'Filter by plan ID',
      },
      status: {
        type: 'string',
        description: 'Filter by status',
      },
      assigneeId: {
        type: 'string',
        description: 'Filter by assignee user ID',
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description: 'Filter by priority',
      },
      search: {
        type: 'string',
        description: 'Search query',
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

export async function executeListTasks(args: unknown) {
  const params = ListTasksSchema.parse(args);

  const queryParams = new URLSearchParams();
  if (params.projectId) queryParams.set('projectId', params.projectId);
  if (params.planId) queryParams.set('planId', params.planId);
  if (params.status) queryParams.set('status', params.status);
  if (params.assigneeId) queryParams.set('assigneeId', params.assigneeId);
  if (params.priority) queryParams.set('priority', params.priority);
  if (params.search) queryParams.set('search', params.search);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const response = await apiClient.get<Task[] | { data: Task[] }>(
    `/api/external/tasks?${queryParams}`
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

// Get Task
const GetTaskSchema = z.object({
  taskId: z.string(),
});

export const getTaskTool: Tool = {
  name: 'get_task',
  description: 'Get details of a specific task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID',
      },
    },
    required: ['taskId'],
  },
};

export async function executeGetTask(args: unknown) {
  const params = GetTaskSchema.parse(args);
  const response = await apiClient.get<Task>(`/api/external/tasks/${params.taskId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Create Task
const CreateTaskSchema = z.object({
  projectId: z.string(),
  planId: z.string(),
  sectionId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const createTaskTool: Tool = {
  name: 'create_task',
  description: 'Create a new task',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      planId: {
        type: 'string',
        description: 'Plan ID',
      },
      sectionId: {
        type: 'string',
        description: 'Section ID',
      },
      title: {
        type: 'string',
        description: 'Task title',
      },
      description: {
        type: 'string',
        description: 'Task description',
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description: 'Task priority',
      },
      dueDate: {
        type: 'string',
        description: 'Due date (ISO 8601 format)',
      },
      assigneeId: {
        type: 'string',
        description: 'Assignee user ID',
      },
    },
    required: ['projectId', 'planId', 'sectionId', 'title'],
  },
};

export async function executeCreateTask(args: unknown) {
  const params = CreateTaskSchema.parse(args);
  const request: CreateTaskRequest = {
    projectId: params.projectId,
    planId: params.planId,
    sectionId: params.sectionId,
    title: params.title,
    description: params.description,
    priority: params.priority,
    dueDate: params.dueDate,
    assigneeId: params.assigneeId,
  };
  const response = await apiClient.post<Task>('/api/external/tasks', request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Update Task
const UpdateTaskSchema = z.object({
  taskId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

export const updateTaskTool: Tool = {
  name: 'update_task',
  description: 'Update an existing task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID',
      },
      title: {
        type: 'string',
        description: 'New task title',
      },
      description: {
        type: 'string',
        description: 'New task description',
      },
      status: {
        type: 'string',
        description: 'New task status',
      },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description: 'New task priority',
      },
      dueDate: {
        type: 'string',
        description: 'New due date (ISO 8601 format)',
      },
      assigneeId: {
        type: 'string',
        description: 'New assignee user ID',
      },
    },
    required: ['taskId'],
  },
};

export async function executeUpdateTask(args: unknown) {
  const params = UpdateTaskSchema.parse(args);
  const request: UpdateTaskRequest = {};
  if (params.title !== undefined) request.title = params.title;
  if (params.description !== undefined) request.description = params.description;
  if (params.status !== undefined) request.status = params.status;
  if (params.priority !== undefined) request.priority = params.priority;
  if (params.dueDate !== undefined) request.dueDate = params.dueDate;
  if (params.assigneeId !== undefined) request.assigneeId = params.assigneeId;

  const response = await apiClient.put<Task>(`/api/external/tasks/${params.taskId}`, request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Delete Task
const DeleteTaskSchema = z.object({
  taskId: z.string(),
});

export const deleteTaskTool: Tool = {
  name: 'delete_task',
  description: 'Delete a task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'Task ID',
      },
    },
    required: ['taskId'],
  },
};

export async function executeDeleteTask(args: unknown) {
  const params = DeleteTaskSchema.parse(args);
  await apiClient.delete(`/api/external/tasks/${params.taskId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: 'Task deleted successfully' }, null, 2),
      },
    ],
  };
}
