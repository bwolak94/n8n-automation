<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: Record<string, unknown>;
}

const props = defineProps<NodeProps<NodeData>>();

const inputField = computed(() =>
  (props.data.config["inputField"] as string | undefined) ?? ""
);
const batchSize = computed(() =>
  (props.data.config["batchSize"] as number | undefined) ?? 1
);
const maxIterations = computed(() =>
  (props.data.config["maxIterations"] as number | undefined) ?? 1000
);
const collectResults = computed(() =>
  (props.data.config["collectResults"] as boolean | undefined) ?? false
);
const continueOnError = computed(() =>
  (props.data.config["continueOnError"] as boolean | undefined) ?? false
);

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};
</script>

<template>
  <div
    class="relative min-w-[180px] rounded-lg border-2 border-amber-400 bg-white shadow-sm"
    data-testid="loop-node"
  >
    <!-- Input handle -->
    <Handle
      type="target"
      :position="Position.Left"
      class="!h-3 !w-3 !bg-gray-400 !border-white"
      data-testid="handle-target"
    />

    <!-- Header -->
    <div class="flex items-center gap-2 px-3 pt-2 pb-1">
      <span class="text-base leading-none" aria-hidden="true">🔁</span>
      <span
        class="flex-1 truncate text-sm font-medium text-gray-800"
        data-testid="node-label"
      >
        {{ props.data.label }}
      </span>
      <span
        class="h-2 w-2 flex-shrink-0 rounded-full"
        :class="statusClasses[props.data.status ?? 'idle']"
        :data-testid="`status-badge-${props.data.status ?? 'idle'}`"
      />
    </div>

    <!-- Config summary -->
    <div class="px-3 pb-2 space-y-0.5">
      <div
        v-if="inputField"
        class="text-[11px] text-gray-500 truncate"
        data-testid="input-field-summary"
      >
        iterating: <span class="font-mono text-amber-700">{{ inputField }}</span>
      </div>
      <div class="flex flex-wrap gap-1">
        <span
          v-if="batchSize > 1"
          class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
          data-testid="batch-size-badge"
        >
          batch {{ batchSize }}
        </span>
        <span
          v-if="collectResults"
          class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
          data-testid="collect-results-badge"
        >
          collect
        </span>
        <span
          v-if="continueOnError"
          class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700"
          data-testid="continue-on-error-badge"
        >
          skip errors
        </span>
        <span
          v-if="maxIterations !== 1000"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
          data-testid="max-iterations-badge"
        >
          max {{ maxIterations }}
        </span>
      </div>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-amber-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
