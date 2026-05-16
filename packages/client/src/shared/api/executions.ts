import { apiClient } from "./client.js";
import type {
  PaginatedResponse,
  ExecutionSummary,
} from "../types/index.js";

export async function fetchExecution(id: string): Promise<ExecutionSummary> {
  return apiClient.get(`executions/${id}`).json<ExecutionSummary>();
}

export async function fetchWorkflowExecutions(
  workflowId: string,
  limit = 20,
  offset = 0
): Promise<PaginatedResponse<ExecutionSummary>> {
  return apiClient
    .get(`workflows/${workflowId}/executions`, {
      searchParams: { limit, offset },
    })
    .json<PaginatedResponse<ExecutionSummary>>();
}

export async function cancelExecution(id: string): Promise<void> {
  await apiClient.post(`executions/${id}/cancel`);
}
