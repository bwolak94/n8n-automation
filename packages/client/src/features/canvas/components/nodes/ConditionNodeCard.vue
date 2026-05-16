<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NodeProps } from "@vue-flow/core";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: Record<string, unknown>;
}

const props = defineProps<NodeProps<NodeData>>();

const statusClasses: Record<string, string> = {
  idle: "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error: "bg-red-500",
};
</script>

<template>
  <div
    class="relative min-w-[160px] rounded-lg border-2 border-orange-400 bg-white shadow-sm"
    data-testid="condition-node"
  >
    <Handle
      type="target"
      :position="Position.Left"
      class="!h-3 !w-3 !bg-gray-400 !border-white"
      data-testid="handle-target"
    />

    <div class="flex items-center gap-2 px-3 py-2">
      <span class="text-base leading-none" aria-hidden="true">🔀</span>
      <span class="flex-1 truncate text-sm font-medium text-gray-800" data-testid="node-label">
        {{ props.data.label }}
      </span>
      <span
        class="h-2 w-2 flex-shrink-0 rounded-full"
        :class="statusClasses[props.data.status ?? 'idle']"
        :data-testid="`status-badge-${props.data.status ?? 'idle'}`"
      />
    </div>

    <!-- True branch -->
    <div class="flex items-center justify-end gap-1 px-3 pb-1 pt-0">
      <span class="text-xs font-medium text-green-600" data-testid="handle-true-label">true</span>
      <Handle
        type="source"
        :position="Position.Right"
        id="true"
        class="!static !relative !h-3 !w-3 !transform-none !bg-green-400 !border-white"
        data-testid="handle-true"
      />
    </div>

    <!-- False branch -->
    <div class="flex items-center justify-end gap-1 px-3 pb-2 pt-0">
      <span class="text-xs font-medium text-red-600" data-testid="handle-false-label">false</span>
      <Handle
        type="source"
        :position="Position.Right"
        id="false"
        class="!static !relative !h-3 !w-3 !transform-none !bg-red-400 !border-white"
        data-testid="handle-false"
      />
    </div>
  </div>
</template>
