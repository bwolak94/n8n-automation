import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import type { Ref } from "vue";
import {
  fetchExecution,
  fetchWorkflowExecutions,
  cancelExecution,
} from "../api/executions.js";
import type { ExecutionSummary } from "../types/index.js";

export const EXECUTIONS_KEY = "executions";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function useExecutionQuery(id: string) {
  return useQuery({
    queryKey: [EXECUTIONS_KEY, id],
    queryFn: () => fetchExecution(id),
    enabled: !!id,
  });
}

export function useExecutionPollingQuery(id: Ref<string | null>) {
  return useQuery({
    queryKey: [EXECUTIONS_KEY, id],
    queryFn: () => fetchExecution(id.value!),
    enabled: () => !!id.value,
    refetchInterval: (query) => {
      const data = query.state.data as ExecutionSummary | undefined;
      if (!data) return 1500;
      return TERMINAL_STATUSES.has(data.status) ? false : 1500;
    },
  });
}

export function useWorkflowExecutionsQuery(
  workflowId: string,
  limit = 20,
  offset = 0
) {
  return useQuery({
    queryKey: [EXECUTIONS_KEY, "workflow", workflowId, { limit, offset }],
    queryFn: () => fetchWorkflowExecutions(workflowId, limit, offset),
    enabled: !!workflowId,
  });
}

export function useCancelExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelExecution,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [EXECUTIONS_KEY, id] });
    },
  });
}
