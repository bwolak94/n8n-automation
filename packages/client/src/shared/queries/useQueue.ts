import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { fetchDlqEntries, retryDlqJob, discardDlqJob } from "../api/queue.js";
import type { DlqEntry } from "../types/index.js";

export const DLQ_KEY = "queue-dlq";

export function useDlqQuery(limit = 20, offset = 0) {
  return useQuery({
    queryKey: [DLQ_KEY, { limit, offset }],
    queryFn: () => fetchDlqEntries(limit, offset),
  });
}

export function useRetryDlqJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryDlqJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DLQ_KEY] });
    },
  });
}

export function useDiscardDlqJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discardDlqJob,
    onMutate: async (jobId: string) => {
      await queryClient.cancelQueries({ queryKey: [DLQ_KEY] });
      const previous = queryClient.getQueriesData<{ items: DlqEntry[]; total: number }>({
        queryKey: [DLQ_KEY],
      });
      queryClient.setQueriesData<{ items: DlqEntry[]; total: number; limit: number; offset: number }>(
        { queryKey: [DLQ_KEY] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((e) => e.id !== jobId),
            total: Math.max(0, old.total - 1),
          };
        }
      );
      return { previous };
    },
    onError: (_err, _jobId, context) => {
      if (context?.previous) {
        for (const [queryKey, data] of context.previous) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [DLQ_KEY] });
    },
  });
}
