import { apiClient } from "./client.js";
import type { DlqEntry, PaginatedResponse } from "../types/index.js";

export async function fetchDlqEntries(
  limit = 20,
  offset = 0
): Promise<PaginatedResponse<DlqEntry>> {
  return apiClient
    .get("queue/dlq", { searchParams: { limit, offset } })
    .json<PaginatedResponse<DlqEntry>>();
}

export async function retryDlqJob(jobId: string): Promise<void> {
  await apiClient.post(`queue/dlq/${jobId}/retry`);
}

export async function discardDlqJob(jobId: string): Promise<void> {
  await apiClient.delete(`queue/dlq/${jobId}`);
}
