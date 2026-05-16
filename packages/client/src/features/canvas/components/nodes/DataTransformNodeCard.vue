<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";

interface TransformOp { op: string; fields?: string[]; field?: string; mapping?: Record<string, string> }

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: Record<string, unknown>;
}

const props = defineProps<NodeProps<NodeData>>();

const operations = computed(
  () => (props.data.config["operations"] as TransformOp[] | undefined) ?? []
);
const inputField  = computed(() => props.data.config["inputField"]  as string | undefined);
const outputField = computed(() => props.data.config["outputField"] as string | undefined);

const opSummary = computed(() => {
  if (operations.value.length === 0) return "no operations";
  return operations.value
    .slice(0, 3)
    .map((o) => o.op)
    .join(" → ") + (operations.value.length > 3 ? ` +${operations.value.length - 3}` : "");
});

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};

const OP_COLORS: Record<string, string> = {
  pick:    "bg-blue-100 text-blue-700",
  omit:    "bg-red-100 text-red-700",
  rename:  "bg-purple-100 text-purple-700",
  compute: "bg-green-100 text-green-700",
  filter:  "bg-orange-100 text-orange-700",
  sort:    "bg-yellow-100 text-yellow-700",
  groupBy: "bg-indigo-100 text-indigo-700",
  flatten: "bg-teal-100 text-teal-700",
  merge:   "bg-pink-100 text-pink-700",
};
</script>

<template>
  <div
    class="relative min-w-[200px] rounded-lg border-2 border-teal-400 bg-white shadow-sm"
    data-testid="data-transform-node"
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
      <span class="text-base leading-none" aria-hidden="true">⚙️</span>
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

    <!-- Operation pipeline summary -->
    <div class="px-3 pb-2 space-y-1">
      <div
        class="text-[11px] text-gray-500 truncate"
        data-testid="op-summary"
      >
        {{ opSummary }}
      </div>

      <!-- Op type badges -->
      <div v-if="operations.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="(o, i) in operations.slice(0, 4)"
          :key="i"
          class="rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="OP_COLORS[o.op] ?? 'bg-gray-100 text-gray-600'"
          data-testid="op-badge"
        >
          {{ o.op }}
        </span>
        <span
          v-if="operations.length > 4"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
        >
          +{{ operations.length - 4 }}
        </span>
      </div>

      <!-- Field routing badges -->
      <div v-if="inputField || outputField" class="flex flex-wrap gap-1">
        <span
          v-if="inputField"
          class="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 truncate max-w-[90px]"
          data-testid="input-field-badge"
        >
          in: {{ inputField }}
        </span>
        <span
          v-if="outputField"
          class="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 truncate max-w-[90px]"
          data-testid="output-field-badge"
        >
          out: {{ outputField }}
        </span>
      </div>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-teal-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
