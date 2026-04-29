import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  fetchWorkflows,
  fetchWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from "../api/workflows.js";

export const WORKFLOWS_KEY = "workflows";

export function useWorkflowsQuery(limit = 20, offset = 0) {
  return useQuery({
    queryKey: [WORKFLOWS_KEY, { limit, offset }],
    queryFn: () => fetchWorkflows(limit, offset),
  });
}

export function useWorkflowQuery(id: string) {
  return useQuery({
    queryKey: [WORKFLOWS_KEY, id],
    queryFn: () => fetchWorkflow(id),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WORKFLOWS_KEY] }),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: Parameters<typeof updateWorkflow>[0] extends string
      ? { id: string; data: Parameters<typeof updateWorkflow>[1] }
      : never) => updateWorkflow(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [WORKFLOWS_KEY, id] });
      queryClient.invalidateQueries({ queryKey: [WORKFLOWS_KEY] });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [WORKFLOWS_KEY] }),
  });
}

export function useExecuteWorkflow() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      executeWorkflow(id, data),
  });
}
