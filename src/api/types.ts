// OAuth Token Response
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
}

// Plan types
export interface Plan {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanRequest {
  name: string;
  description?: string;
}

export interface UpdatePlanRequest {
  name?: string;
  description?: string;
}

// Task types
export interface Task {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  projectId: string;
  planId: string;
  sectionId: string;
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  projectId: string;
  planId: string;
  sectionId: string;
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  assigneeId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  assigneeId?: string;
}

// Note types
export interface Note {
  id: string;
  title: string;
  content?: string;
  parentId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  content?: string;
  parentId?: string;
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
}

// Todo types
export interface Todo {
  id: string;
  taskId: string;
  userId: string;
  createdAt: string;
}

export interface CreateTodoRequest {
  taskId: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  page?: number;
  limit?: number;
  total?: number;
}

// API Error types
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
