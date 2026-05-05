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

const code      = computed(() => (props.data.config["code"]      as string | undefined) ?? "");
const timeoutMs = computed(() => (props.data.config["timeoutMs"] as number | undefined) ?? 5000);
const memoryMb  = computed(() => (props.data.config["memoryMb"]  as number | undefined) ?? 32);

/** Show first non-empty line of code as a preview. */
const codePreview = computed(() => {
  const lines = code.value.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "// empty";
  return lines[0]!.length > 40 ? lines[0]!.slice(0, 40) + "…" : lines[0]!;
});

const lineCount = computed(() => code.value.split("\n").filter(Boolean).length);

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};
</script>

<template>
  <div
    class="relative min-w-[210px] rounded-lg border-2 border-green-500 bg-white shadow-sm"
    data-testid="function-node"
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
      <span class="text-base leading-none font-mono" aria-hidden="true">ƒ</span>
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

    <!-- Code preview -->
    <div class="px-3 pb-1">
      <div
        class="rounded bg-gray-50 px-2 py-1 font-mono text-[10px] text-gray-600 truncate"
        data-testid="code-preview"
      >
        {{ codePreview }}
      </div>
    </div>

    <!-- Badges -->
    <div class="flex flex-wrap gap-1 px-3 pb-2">
      <span
        class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
        data-testid="line-count-badge"
      >
        {{ lineCount }} line{{ lineCount !== 1 ? "s" : "" }}
      </span>
      <span
        v-if="timeoutMs !== 5000"
        class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
        data-testid="timeout-badge"
      >
        {{ timeoutMs }}ms
      </span>
      <span
        v-if="memoryMb !== 32"
        class="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
        data-testid="memory-badge"
      >
        {{ memoryMb }}MB
      </span>
    </div>

    <!-- Output handle -->
    <Handle
      type="source"
      :position="Position.Right"
      class="!h-3 !w-3 !bg-green-500 !border-white"
      data-testid="handle-source"
    />
  </div>
</template>
