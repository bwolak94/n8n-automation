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

const mode = computed(() =>
  (props.data.config["mode"] as string | undefined) ?? "duration"
);
const duration = computed(() =>
  props.data.config["duration"] as { value: number; unit: string } | undefined
);
const until = computed(() =>
  props.data.config["until"] as string | undefined
);
const maxWaitDays = computed(() =>
  (props.data.config["maxWaitDays"] as number | undefined) ?? 30
);

const modeSummary = computed(() => {
  if (mode.value === "duration" && duration.value) {
    return `${duration.value.value} ${duration.value.unit}`;
  }
  if (mode.value === "until" && until.value) {
    const d = new Date(until.value);
    return isNaN(d.getTime()) ? until.value : d.toLocaleString();
  }
  if (mode.value === "webhook") {
    return `webhook (max ${maxWaitDays.value}d)`;
  }
  return mode.value;
});

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  waiting: "bg-yellow-400 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};

const modeIcon: Record<string, string> = {
  duration: "⏱",
  until:    "📅",
  webhook:  "🔗",
};
</script>

<template>
  <div
    class="relative min-w-[180px] rounded-lg border-2 border-yellow-400 bg-white shadow-sm"
    data-testid="wait-node"
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
      <span class="text-base leading-none" aria-hidden="true">{{ modeIcon[mode] ?? "⏳" }}</span>
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
        class="text-[11px] text-gray-500 truncate"
        data-testid="mode-summary"
      >
        {{ modeSummary }}
      </div>

      <div class="flex flex-wrap gap-1">
        <span
          class="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700"
          data-testid="mode-badge"
        >
          {{ mode }}
        </span>
        <span
          v-if="maxWaitDays !== 30"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
          data-testid="max-wait-badge"
        >
          max {{ maxWaitDays }}d
        </span>
      </div>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-yellow-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
