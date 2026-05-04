<script setup lang="ts">
import { computed } from "vue";
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error" | "waiting";
  category: string;
  config: Record<string, unknown>;
}

const props = defineProps<NodeProps<NodeData>>();

const mode       = computed(() => (props.data.config["mode"]       as string  | undefined) ?? "waitAll");
const inputCount = computed(() => (props.data.config["inputCount"] as number  | undefined) ?? 2);
const joinKey    = computed(() => (props.data.config["joinKey"]    as string  | undefined));
const joinType   = computed(() => (props.data.config["joinType"]   as string  | undefined) ?? "inner");
const timeoutMs  = computed(() => (props.data.config["timeoutMs"]  as number  | undefined));

const modeSummary = computed(() => {
  switch (mode.value) {
    case "waitAll":    return `wait for all ${inputCount.value} branches`;
    case "mergeByKey": return `join on "${joinKey.value ?? "id"}" (${joinType.value})`;
    case "append":     return `append ${inputCount.value} arrays`;
    case "firstWins":  return "first branch wins";
    default:           return mode.value;
  }
});

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  waiting: "bg-yellow-400 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};

const MODE_COLORS: Record<string, string> = {
  waitAll:    "bg-violet-100 text-violet-700",
  mergeByKey: "bg-blue-100 text-blue-700",
  append:     "bg-green-100 text-green-700",
  firstWins:  "bg-orange-100 text-orange-700",
};
</script>

<template>
  <div
    class="relative min-w-[200px] rounded-lg border-2 border-violet-400 bg-white shadow-sm"
    data-testid="merge-node"
  >
    <!-- Input handles — one per branch, evenly spaced on left side -->
    <Handle
      v-for="i in inputCount"
      :key="`in-${i}`"
      type="target"
      :position="Position.Left"
      :id="`branch-${i - 1}`"
      :style="{ top: `${(i / (inputCount + 1)) * 100}%` }"
      class="!h-3 !w-3 !bg-gray-400 !border-white"
      :data-testid="`handle-target-${i - 1}`"
    />

    <!-- Header -->
    <div class="flex items-center gap-2 px-3 pt-2 pb-1">
      <span class="text-base leading-none" aria-hidden="true">⇶</span>
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
    <div class="px-3 pb-2 space-y-1">
      <div
        class="text-[11px] text-gray-500 truncate"
        data-testid="mode-summary"
      >
        {{ modeSummary }}
      </div>

      <div class="flex flex-wrap gap-1">
        <!-- Mode badge -->
        <span
          class="rounded px-1.5 py-0.5 text-[10px] font-medium"
          :class="MODE_COLORS[mode] ?? 'bg-gray-100 text-gray-600'"
          data-testid="mode-badge"
        >
          {{ mode }}
        </span>

        <!-- Input count badge -->
        <span
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
          data-testid="input-count-badge"
        >
          {{ inputCount }} inputs
        </span>

        <!-- Join key badge (mergeByKey mode only) -->
        <span
          v-if="mode === 'mergeByKey' && joinKey"
          class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 truncate max-w-[80px]"
          data-testid="join-key-badge"
        >
          key: {{ joinKey }}
        </span>

        <!-- Timeout badge -->
        <span
          v-if="timeoutMs !== undefined"
          class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
          data-testid="timeout-badge"
        >
          {{ timeoutMs }}ms
        </span>
      </div>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-violet-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
