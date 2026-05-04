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

const subWorkflowId = computed(() =>
  (props.data.config["subWorkflowId"] as string | undefined) ?? ""
);
const waitForResult = computed(() =>
  (props.data.config["waitForResult"] as boolean | undefined) ?? true
);
const timeout = computed(() =>
  (props.data.config["timeout"] as number | undefined) ?? 30_000
);
const inputMapping = computed(() => {
  const m = props.data.config["inputMapping"] as Record<string, unknown> | undefined;
  return m ? Object.keys(m) : [];
});

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};
</script>

<template>
  <div
    class="relative min-w-[200px] rounded-lg border-2 border-indigo-400 bg-white shadow-sm"
    data-testid="sub-workflow-node"
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
      <span class="text-base leading-none" aria-hidden="true">🔀</span>
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
        v-if="subWorkflowId"
        class="text-[11px] text-gray-500 truncate"
        data-testid="sub-workflow-id"
      >
        calls: <span class="font-mono text-indigo-700">{{ subWorkflowId }}</span>
      </div>

      <div
        v-if="inputMapping.length > 0"
        class="text-[11px] text-gray-400 truncate"
        data-testid="input-mapping-summary"
      >
        maps: {{ inputMapping.join(", ") }}
      </div>

      <div class="flex flex-wrap gap-1">
        <span
          v-if="!waitForResult"
          class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700"
          data-testid="async-badge"
        >
          async
        </span>
        <span
          v-if="waitForResult && timeout !== 30_000"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
          data-testid="timeout-badge"
        >
          {{ timeout / 1000 }}s timeout
        </span>
      </div>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-indigo-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
