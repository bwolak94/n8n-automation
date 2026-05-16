<script setup lang="ts">
import { computed, toRef } from "vue";
import { useExecutionPollingQuery } from "../../../shared/queries/useExecutions.js";
import ExecutionStepRow from "./ExecutionStepRow.vue";
import CancelExecutionButton from "./CancelExecutionButton.vue";

interface Props {
  executionId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{ close: [] }>();

const executionIdRef = toRef(props, "executionId");
const { data: execution, isPending, isError } = useExecutionPollingQuery(executionIdRef);

const statusColors: Record<string, string> = {
  running: "bg-violet-100 text-violet-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  pending: "bg-yellow-100 text-yellow-700",
};

const durationLabel = computed(() => {
  const ms = execution.value?.durationMs;
  if (ms === undefined || ms === null) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
});
</script>

<template>
  <aside
    class="flex h-full flex-col overflow-hidden border-l border-gray-200 bg-white"
    data-testid="execution-log-panel"
    role="complementary"
    aria-label="Execution log"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
      <h2 class="text-sm font-semibold text-gray-800">Execution Log</h2>
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-gray-100"
        aria-label="Close panel"
        @click="emit('close')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- No execution selected -->
    <div v-if="!executionId" class="flex flex-1 items-center justify-center p-8 text-center">
      <p class="text-sm text-gray-400">Select an execution to view its log.</p>
    </div>

    <!-- Loading skeleton -->
    <div v-else-if="isPending" class="flex flex-1 items-center justify-center p-8" data-testid="execution-loading">
      <svg class="h-6 w-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="isError" class="p-4">
      <p class="text-sm text-red-600">Failed to load execution. Please try again.</p>
    </div>

    <!-- Content -->
    <template v-else-if="execution">
      <!-- Execution meta -->
      <div class="border-b border-gray-100 px-4 py-3" data-testid="execution-meta">
        <div class="mb-2 flex items-center gap-2">
          <span
            class="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
            :class="statusColors[execution.status] ?? 'bg-gray-100 text-gray-500'"
            data-testid="execution-status-badge"
          >
            {{ execution.status }}
          </span>
          <span v-if="durationLabel" class="text-xs text-gray-400" data-testid="execution-duration">
            {{ durationLabel }}
          </span>
          <div class="ml-auto">
            <CancelExecutionButton
              :execution-id="execution.id"
              :status="execution.status"
            />
          </div>
        </div>
        <p class="text-xs text-gray-400">
          Started: {{ new Date(execution.startedAt).toLocaleString() }}
        </p>
        <p v-if="execution.error" class="mt-1 text-xs text-red-500" data-testid="execution-error">
          {{ execution.error }}
        </p>
      </div>

      <!-- Steps -->
      <div class="flex-1 space-y-2 overflow-y-auto p-4" data-testid="execution-steps">
        <p v-if="execution.steps.length === 0" class="text-sm text-gray-400">
          No steps recorded.
        </p>
        <ExecutionStepRow
          v-for="step in execution.steps"
          :key="step.id"
          :step="step"
        />
      </div>
    </template>
  </aside>
</template>
