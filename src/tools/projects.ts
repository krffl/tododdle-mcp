import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient } from '../api/client.js';
import { Project, CreateProjectRequest, UpdateProjectRequest } from '../api/types.js';

// List Projects
const ListProjectsSchema = z.object({
  organizationId: z.string().optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export const listProjectsTool: Tool = {
  name: 'list_projects',
  description: 'List all projects in an organization with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      organizationId: {
        type: 'string',
        description: 'Organization ID to filter projects',
      },
      search: {
        type: 'string',
        description: 'Search query for project names',
      },
      status: {
        type: 'string',
        description: 'Filter by project status',
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

export async function executeListProjects(args: unknown) {
  const params = ListProjectsSchema.parse(args);

  const queryParams = new URLSearchParams();
  if (params.organizationId) queryParams.set('organizationId', params.organizationId);
  if (params.search) queryParams.set('search', params.search);
  if (params.status) queryParams.set('status', params.status);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const response = await apiClient.get<Project[] | { data: Project[] }>(
    `/api/external/projects?${queryParams}`
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

// Get Project
const GetProjectSchema = z.object({
  projectId: z.string(),
});

export const getProjectTool: Tool = {
  name: 'get_project',
  description: 'Get details of a specific project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
    },
    required: ['projectId'],
  },
};

export async function executeGetProject(args: unknown) {
  const params = GetProjectSchema.parse(args);
  const response = await apiClient.get<Project>(`/api/external/projects/${params.projectId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Create Project
const CreateProjectSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const createProjectTool: Tool = {
  name: 'create_project',
  description: 'Create a new project',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name',
      },
      description: {
        type: 'string',
        description: 'Project description',
      },
    },
    required: ['name'],
  },
};

export async function executeCreateProject(args: unknown) {
  const params = CreateProjectSchema.parse(args);
  const request: CreateProjectRequest = {
    name: params.name,
    description: params.description,
  };
  const response = await apiClient.post<Project>('/api/external/projects', request);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Update Project
const UpdateProjectSchema = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const updateProjectTool: Tool = {
  name: 'update_project',
  description: 'Update an existing project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      name: {
        type: 'string',
        description: 'New project name',
      },
      description: {
        type: 'string',
        description: 'New project description',
      },
    },
    required: ['projectId'],
  },
};

export async function executeUpdateProject(args: unknown) {
  const params = UpdateProjectSchema.parse(args);
  const request: UpdateProjectRequest = {};
  if (params.name !== undefined) request.name = params.name;
  if (params.description !== undefined) request.description = params.description;

  const response = await apiClient.put<Project>(
    `/api/external/projects/${params.projectId}`,
    request
  );
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response.data, null, 2),
      },
    ],
  };
}

// Delete Project
const DeleteProjectSchema = z.object({
  projectId: z.string(),
});

export const deleteProjectTool: Tool = {
  name: 'delete_project',
  description: 'Delete a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
    },
    required: ['projectId'],
  },
};

export async function executeDeleteProject(args: unknown) {
  const params = DeleteProjectSchema.parse(args);
  await apiClient.delete(`/api/external/projects/${params.projectId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: 'Project deleted successfully' }, null, 2),
      },
    ],
  };
}
