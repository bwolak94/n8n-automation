<script setup lang="ts">
import { ref, computed } from "vue";
import type { ExecutionStep } from "../../../shared/types/index.js";

interface Props {
  step: ExecutionStep;
}

const props = defineProps<Props>();

const expanded = ref(false);

const statusIcon = computed(() => {
  switch (props.step.status) {
    case "running": return "spinner";
    case "success":
    case "completed": return "check";
    case "failed": return "error";
    case "skipped": return "skipped";
    default: return "skipped";
  }
});

const durationLabel = computed(() => {
  const ms = props.step.durationMs;
  if (ms === undefined || ms === null) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
});

const hasInputOutput = computed(
  () => !!(props.step as unknown as Record<string, unknown>)["input"] ||
        !!(props.step as unknown as Record<string, unknown>)["output"]
);

const stepData = computed(() => props.step as unknown as Record<string, unknown>);
</script>

<template>
  <div
    class="rounded-lg border border-gray-100 bg-white"
    data-testid="execution-step-row"
    :data-status="step.status"
  >
    <div
      class="flex cursor-pointer items-center gap-3 px-4 py-3"
      role="button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <!-- Status icon -->
      <span class="flex h-5 w-5 shrink-0 items-center justify-center" :data-testid="`step-icon-${step.status}`">
        <!-- Spinner -->
        <svg
          v-if="statusIcon === 'spinner'"
          class="h-4 w-4 animate-spin text-violet-500"
          fill="none"
          viewBox="0 0 24 24"
          aria-label="Running"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <!-- Check -->
        <svg
          v-else-if="statusIcon === 'check'"
          class="h-4 w-4 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
          aria-label="Success"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <!-- Error X -->
        <svg
          v-else-if="statusIcon === 'error'"
          class="h-4 w-4 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
          aria-label="Failed"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <!-- Dash (skipped) -->
        <svg
          v-else
          class="h-4 w-4 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
          aria-label="Skipped"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
        </svg>
      </span>

      <!-- Node label -->
      <span class="flex-1 text-sm font-medium text-gray-800" data-testid="step-node-type">
        {{ step.nodeType }}
      </span>

      <!-- Duration -->
      <span
        v-if="durationLabel"
        class="shrink-0 text-xs text-gray-400"
        data-testid="step-duration"
      >
        {{ durationLabel }}
      </span>

      <!-- Error badge -->
      <span
        v-if="step.error"
        class="shrink-0 max-w-[180px] truncate text-xs text-red-500"
        :title="step.error"
        data-testid="step-error"
      >
        {{ step.error }}
      </span>

      <!-- Expand chevron -->
      <svg
        v-if="hasInputOutput"
        class="h-4 w-4 shrink-0 text-gray-400 transition-transform"
        :class="{ 'rotate-180': expanded }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Collapsible JSON viewer -->
    <div
      v-if="expanded && hasInputOutput"
      class="border-t border-gray-100 px-4 pb-3 pt-2"
      data-testid="step-json-viewer"
    >
      <div v-if="stepData['input'] !== undefined" class="mb-2">
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Input</p>
        <pre class="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700" data-testid="step-input">{{ JSON.stringify(stepData['input'], null, 2) }}</pre>
      </div>
      <div v-if="stepData['output'] !== undefined">
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Output</p>
        <pre class="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700" data-testid="step-output">{{ JSON.stringify(stepData['output'], null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
