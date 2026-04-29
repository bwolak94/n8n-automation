import { apiClient } from "./client.js";
import type {
  PaginatedResponse,
  ScheduleConfig,
  WorkflowSummary,
} from "../types/index.js";

export interface WorkflowCreateData {
  name: string;
  description?: string;
  nodes?: WorkflowSummary["nodes"];
  edges?: WorkflowSummary["edges"];
  tags?: string[];
  schedule?: ScheduleConfig;
}

export async function fetchWorkflows(
  limit = 20,
  offset = 0
): Promise<PaginatedResponse<WorkflowSummary>> {
  return apiClient
    .get("workflows", { searchParams: { limit, offset } })
    .json<PaginatedResponse<WorkflowSummary>>();
}

export async function fetchWorkflow(id: string): Promise<WorkflowSummary> {
  return apiClient.get(`workflows/${id}`).json<WorkflowSummary>();
}

export async function createWorkflow(
  data: WorkflowCreateData
): Promise<WorkflowSummary> {
  return apiClient
    .post("workflows", { json: data })
    .json<WorkflowSummary>();
}

export async function updateWorkflow(
  id: string,
  data: Partial<WorkflowCreateData>
): Promise<WorkflowSummary> {
  return apiClient
    .put(`workflows/${id}`, { json: data })
    .json<WorkflowSummary>();
}

export async function deleteWorkflow(id: string): Promise<void> {
  await apiClient.delete(`workflows/${id}`);
}

export async function executeWorkflow(
  id: string,
  triggerData: Record<string, unknown> = {}
): Promise<{ jobId: string }> {
  return apiClient
    .post(`workflows/${id}/execute`, { json: triggerData })
    .json<{ jobId: string }>();
}
