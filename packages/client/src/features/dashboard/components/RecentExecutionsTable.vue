<script setup lang="ts">
import { useRouter } from "vue-router";
import type { RecentExecution } from "../../../shared/types/index.js";
import { formatDuration } from "../../../shared/utils/stats.js";

interface Props {
  executions: RecentExecution[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), { loading: false });
const router = useRouter();

const statusColors: Record<string, string> = {
  running: "bg-violet-100 text-violet-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function openExecution(exec: RecentExecution): void {
  void router.push(`/workflows/${exec.workflowId}/executions`);
}
</script>

<template>
  <div
    class="rounded-xl border border-gray-200 bg-white shadow-sm"
    data-testid="recent-executions-table"
  >
    <div class="border-b border-gray-100 px-5 py-4">
      <h3 class="text-sm font-semibold text-gray-700">Recent Executions</h3>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="space-y-3 p-5" data-testid="recent-executions-skeleton">
      <div v-for="i in 5" :key="i" class="h-8 animate-pulse rounded bg-gray-100" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="executions.length === 0"
      class="flex items-center justify-center p-8"
      data-testid="recent-executions-empty"
    >
      <p class="text-sm text-gray-400">No recent executions.</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th class="px-5 py-2.5">Status</th>
            <th class="px-5 py-2.5">Workflow</th>
            <th class="px-5 py-2.5">Duration</th>
            <th class="px-5 py-2.5">Started</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="exec in executions"
            :key="exec.id"
            class="cursor-pointer border-b border-gray-50 last:border-none hover:bg-gray-50"
            data-testid="recent-execution-row"
            tabindex="0"
            role="button"
            @click="openExecution(exec)"
            @keydown.enter="openExecution(exec)"
          >
            <td class="px-5 py-3">
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                :class="statusColors[exec.status] ?? 'bg-gray-100 text-gray-500'"
              >
                {{ exec.status }}
              </span>
            </td>
            <td class="max-w-[160px] truncate px-5 py-3 text-gray-700" :title="exec.workflowName ?? exec.workflowId">
              {{ exec.workflowName ?? exec.workflowId }}
            </td>
            <td class="px-5 py-3 text-gray-500">{{ formatDuration(exec.durationMs) }}</td>
            <td class="px-5 py-3 text-gray-400">{{ formatDate(exec.startedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
