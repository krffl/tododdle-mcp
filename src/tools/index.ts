import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as projects from './projects.js';
import * as plans from './plans.js';
import * as tasks from './tasks.js';
import * as notes from './notes.js';
import * as todos from './todos.js';

export interface ToolDefinition {
  tool: Tool;
  handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

export const tools: Map<string, ToolDefinition> = new Map();

// Register all tools
export function registerTools(): void {
  // Projects tools
  tools.set('list_projects', {
    tool: projects.listProjectsTool,
    handler: projects.executeListProjects,
  });
  tools.set('get_project', {
    tool: projects.getProjectTool,
    handler: projects.executeGetProject,
  });
  tools.set('create_project', {
    tool: projects.createProjectTool,
    handler: projects.executeCreateProject,
  });
  tools.set('update_project', {
    tool: projects.updateProjectTool,
    handler: projects.executeUpdateProject,
  });
  tools.set('delete_project', {
    tool: projects.deleteProjectTool,
    handler: projects.executeDeleteProject,
  });

  // Plans tools
  tools.set('list_plans', {
    tool: plans.listPlansTool,
    handler: plans.executeListPlans,
  });
  tools.set('get_plan', {
    tool: plans.getPlanTool,
    handler: plans.executeGetPlan,
  });
  tools.set('create_plan', {
    tool: plans.createPlanTool,
    handler: plans.executeCreatePlan,
  });
  tools.set('update_plan', {
    tool: plans.updatePlanTool,
    handler: plans.executeUpdatePlan,
  });
  tools.set('delete_plan', {
    tool: plans.deletePlanTool,
    handler: plans.executeDeletePlan,
  });

  // Tasks tools
  tools.set('list_tasks', {
    tool: tasks.listTasksTool,
    handler: tasks.executeListTasks,
  });
  tools.set('get_task', {
    tool: tasks.getTaskTool,
    handler: tasks.executeGetTask,
  });
  tools.set('create_task', {
    tool: tasks.createTaskTool,
    handler: tasks.executeCreateTask,
  });
  tools.set('update_task', {
    tool: tasks.updateTaskTool,
    handler: tasks.executeUpdateTask,
  });
  tools.set('delete_task', {
    tool: tasks.deleteTaskTool,
    handler: tasks.executeDeleteTask,
  });

  // Notes tools
  tools.set('list_notes', {
    tool: notes.listNotesTool,
    handler: notes.executeListNotes,
  });
  tools.set('get_note', {
    tool: notes.getNoteTool,
    handler: notes.executeGetNote,
  });
  tools.set('create_note', {
    tool: notes.createNoteTool,
    handler: notes.executeCreateNote,
  });
  tools.set('update_note', {
    tool: notes.updateNoteTool,
    handler: notes.executeUpdateNote,
  });
  tools.set('delete_note', {
    tool: notes.deleteNoteTool,
    handler: notes.executeDeleteNote,
  });

  // Todos tools
  tools.set('list_todos', {
    tool: todos.listTodosTool,
    handler: todos.executeListTodos,
  });
  tools.set('add_todo', {
    tool: todos.addTodoTool,
    handler: todos.executeAddTodo,
  });
  tools.set('remove_todo', {
    tool: todos.removeTodoTool,
    handler: todos.executeRemoveTodo,
  });
}

export function getAllTools(): Tool[] {
  return Array.from(tools.values()).map((def) => def.tool);
}
