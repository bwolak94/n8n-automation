<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

interface Props {
  label: string;
  icon?: string;
  status?: "idle" | "running" | "success" | "error";
  category?: string;
}

const props = withDefaults(defineProps<Props>(), {
  status: "idle",
});

const statusClasses: Record<NonNullable<Props["status"]>, string> = {
  idle: "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error: "bg-red-500",
};

const categoryBorderClasses: Record<string, string> = {
  triggers: "border-blue-400",
  actions: "border-violet-400",
  logic: "border-orange-400",
  data: "border-green-400",
  ai: "border-pink-400",
  communication: "border-teal-400",
  integrations: "border-indigo-400",
};

const borderClass = props.category ? (categoryBorderClasses[props.category] ?? "border-gray-200") : "border-gray-200";
</script>

<template>
  <div
    class="relative min-w-[160px] rounded-lg border-2 bg-white shadow-sm"
    :class="borderClass"
    data-testid="base-node-card"
  >
    <Handle
      type="target"
      :position="Position.Left"
      class="!h-3 !w-3 !bg-gray-400 !border-white"
      data-testid="handle-target"
    />

    <div class="flex items-center gap-2 px-3 py-2">
      <span v-if="icon" class="text-base leading-none" aria-hidden="true" data-testid="node-icon">
        {{ icon }}
      </span>
      <span class="flex-1 truncate text-sm font-medium text-gray-800" data-testid="node-label">
        {{ label }}
      </span>
      <span
        class="h-2 w-2 flex-shrink-0 rounded-full"
        :class="statusClasses[status ?? 'idle']"
        :data-testid="`status-badge-${status ?? 'idle'}`"
        :aria-label="`Status: ${status ?? 'idle'}`"
      />
    </div>

    <slot />

    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-gray-400 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
