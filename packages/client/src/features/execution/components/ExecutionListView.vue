<script setup lang="ts">
import { ref, computed } from "vue";
import { useWorkflowExecutionsQuery } from "../../../shared/queries/useExecutions.js";

interface Props {
  workflowId: string;
  workflowName?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{ select: [executionId: string] }>();

const limit = 20;
const offset = ref(0);

const { data, isPending, isError } = useWorkflowExecutionsQuery(
  props.workflowId,
  limit,
  offset.value
);

const totalPages = computed(() =>
  data.value ? Math.ceil(data.value.total / limit) : 0
);
const currentPage = computed(() => Math.floor(offset.value / limit) + 1);

function prevPage(): void {
  if (offset.value >= limit) offset.value -= limit;
}

function nextPage(): void {
  if (data.value && offset.value + limit < data.value.total) offset.value += limit;
}

const statusColors: Record<string, string> = {
  running: "bg-violet-100 text-violet-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
};

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}
</script>

<template>
  <section class="flex flex-col" data-testid="execution-list-view">
    <!-- Header -->
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold text-gray-800">
        {{ workflowName ? `Executions — ${workflowName}` : "Executions" }}
      </h2>
    </div>

    <!-- Loading -->
    <div v-if="isPending" class="flex items-center justify-center py-12" data-testid="executions-loading">
      <svg class="h-6 w-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="isError" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-600">Failed to load executions. Please refresh.</p>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!data?.items?.length"
      class="flex flex-col items-center py-12 text-center"
      data-testid="executions-empty"
    >
      <p class="text-sm text-gray-400">No executions yet.</p>
    </div>

    <!-- Table -->
    <template v-else>
      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full text-sm" data-testid="executions-table">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th class="px-4 py-2.5">Status</th>
              <th class="px-4 py-2.5">Started at</th>
              <th class="px-4 py-2.5">Duration</th>
              <th class="px-4 py-2.5">Steps</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="execution in data.items"
              :key="execution.id"
              class="cursor-pointer border-b border-gray-100 last:border-none hover:bg-gray-50"
              data-testid="execution-row"
              tabindex="0"
              role="button"
              :aria-label="`View execution ${execution.id}`"
              @click="emit('select', execution.id)"
              @keydown.enter="emit('select', execution.id)"
            >
              <td class="px-4 py-3">
                <span
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                  :class="statusColors[execution.status] ?? 'bg-gray-100 text-gray-500'"
                  :data-testid="`status-${execution.id}`"
                >
                  {{ execution.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600">
                {{ formatDate(execution.startedAt) }}
              </td>
              <td class="px-4 py-3 text-gray-500">
                {{ formatDuration(execution.durationMs) }}
              </td>
              <td class="px-4 py-3 text-gray-500">
                {{ execution.steps.length }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="mt-4 flex items-center justify-between text-sm text-gray-500"
        data-testid="executions-pagination"
      >
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === 1"
            data-testid="prev-page"
            @click="prevPage"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="currentPage === totalPages"
            data-testid="next-page"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
