import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiClient } from '../api/client.js';
import { Plan, CreatePlanRequest, UpdatePlanRequest } from '../api/types.js';

// List Plans
const ListPlansSchema = z.object({
  projectId: z.string(),
  search: z.string().optional(),
});

export const listPlansTool: Tool = {
  name: 'list_plans',
  description: 'List all plans for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      search: {
        type: 'string',
        description: 'Search query for plan names',
      },
    },
    required: ['projectId'],
  },
};

export async function executeListPlans(args: unknown) {
  const params = ListPlansSchema.parse(args);

  const queryParams = new URLSearchParams();
  if (params.search) queryParams.set('search', params.search);

  const response = await apiClient.get<Plan[] | { data: Plan[] }>(
    `/api/external/projects/${params.projectId}/plans?${queryParams}`
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

// Get Plan
const GetPlanSchema = z.object({
  projectId: z.string(),
  planId: z.string(),
});

export const getPlanTool: Tool = {
  name: 'get_plan',
  description: 'Get details of a specific plan',
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
    },
    required: ['projectId', 'planId'],
  },
};

export async function executeGetPlan(args: unknown) {
  const params = GetPlanSchema.parse(args);
  const response = await apiClient.get<Plan>(
    `/api/external/projects/${params.projectId}/plans/${params.planId}`
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

// Create Plan
const CreatePlanSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const createPlanTool: Tool = {
  name: 'create_plan',
  description: 'Create a new plan',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      name: {
        type: 'string',
        description: 'Plan name',
      },
      description: {
        type: 'string',
        description: 'Plan description',
      },
    },
    required: ['projectId', 'name'],
  },
};

export async function executeCreatePlan(args: unknown) {
  const params = CreatePlanSchema.parse(args);
  const request: CreatePlanRequest = {
    name: params.name,
    description: params.description,
  };
  const response = await apiClient.post<Plan>(
    `/api/external/projects/${params.projectId}/plans`,
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

// Update Plan
const UpdatePlanSchema = z.object({
  projectId: z.string(),
  planId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const updatePlanTool: Tool = {
  name: 'update_plan',
  description: 'Update an existing plan',
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
      name: {
        type: 'string',
        description: 'New plan name',
      },
      description: {
        type: 'string',
        description: 'New plan description',
      },
    },
    required: ['projectId', 'planId'],
  },
};

export async function executeUpdatePlan(args: unknown) {
  const params = UpdatePlanSchema.parse(args);
  const request: UpdatePlanRequest = {};
  if (params.name !== undefined) request.name = params.name;
  if (params.description !== undefined) request.description = params.description;

  const response = await apiClient.put<Plan>(
    `/api/external/projects/${params.projectId}/plans/${params.planId}`,
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

// Delete Plan
const DeletePlanSchema = z.object({
  projectId: z.string(),
  planId: z.string(),
});

export const deletePlanTool: Tool = {
  name: 'delete_plan',
  description: 'Delete a plan',
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
    },
    required: ['projectId', 'planId'],
  },
};

export async function executeDeletePlan(args: unknown) {
  const params = DeletePlanSchema.parse(args);
  await apiClient.delete(`/api/external/projects/${params.projectId}/plans/${params.planId}`);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: 'Plan deleted successfully' }, null, 2),
      },
    ],
  };
}
