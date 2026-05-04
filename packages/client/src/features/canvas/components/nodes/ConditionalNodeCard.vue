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

const mode = computed(() => (props.data.config["mode"] as string | undefined) ?? "if");

const statusClasses: Record<string, string> = {
  idle:    "bg-gray-300",
  running: "bg-blue-500 animate-pulse",
  success: "bg-green-500",
  error:   "bg-red-500",
};

const switchRules = computed(() => {
  if (mode.value !== "switch") return [];
  const rules = props.data.config["rules"] as Array<{ label: string }> | undefined;
  return rules ?? [];
});

const conditionSummary = computed(() => {
  if (mode.value !== "if") return "";
  const conditions = props.data.config["conditions"] as Array<{
    field: string; operator: string; value?: unknown
  }> | undefined;
  if (!conditions || conditions.length === 0) return "No conditions";
  const first = conditions[0]!;
  const suffix = conditions.length > 1 ? ` +${conditions.length - 1}` : "";
  return `${first.field} ${first.operator}${suffix}`;
});
</script>

<template>
  <div
    class="relative min-w-[180px] rounded-lg border-2 border-purple-400 bg-white shadow-sm"
    data-testid="conditional-node"
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
      <span class="text-base leading-none" aria-hidden="true">
        {{ mode === "switch" ? "🔀" : "⚡" }}
      </span>
      <span
        class="flex-1 truncate text-sm font-medium text-gray-800"
        data-testid="node-label"
      >
        {{ props.data.label }}
      </span>
      <span
        class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        :class="mode === 'switch' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'"
        data-testid="mode-badge"
      >
        {{ mode }}
      </span>
      <span
        class="h-2 w-2 flex-shrink-0 rounded-full"
        :class="statusClasses[props.data.status ?? 'idle']"
        :data-testid="`status-badge-${props.data.status ?? 'idle'}`"
      />
    </div>

    <!-- If mode: condition summary -->
    <template v-if="mode === 'if'">
      <div class="px-3 pb-1 text-[11px] text-gray-500 truncate" data-testid="condition-summary">
        {{ conditionSummary }}
      </div>

      <!-- True branch -->
      <div class="flex items-center justify-end gap-1 px-3 pb-1">
        <span class="text-xs font-medium text-green-600" data-testid="handle-true-label">true</span>
        <Handle
          type="source"
          :position="Position.Right"
          id="0"
          class="!static !relative !h-3 !w-3 !transform-none !bg-green-400 !border-white"
          data-testid="handle-branch-0"
        />
      </div>

      <!-- False branch -->
      <div class="flex items-center justify-end gap-1 px-3 pb-2">
        <span class="text-xs font-medium text-red-600" data-testid="handle-false-label">false</span>
        <Handle
          type="source"
          :position="Position.Right"
          id="1"
          class="!static !relative !h-3 !w-3 !transform-none !bg-red-400 !border-white"
          data-testid="handle-branch-1"
        />
      </div>
    </template>

    <!-- Switch mode: one handle per rule -->
    <template v-else-if="mode === 'switch'">
      <div
        v-for="(rule, idx) in switchRules"
        :key="idx"
        class="flex items-center justify-end gap-1 px-3 pb-1"
        :data-testid="`switch-rule-${idx}`"
      >
        <span class="max-w-[100px] truncate text-xs text-gray-600">{{ rule.label || `Branch ${idx}` }}</span>
        <Handle
          type="source"
          :position="Position.Right"
          :id="String(idx)"
          class="!static !relative !h-3 !w-3 !transform-none !bg-purple-400 !border-white"
          :data-testid="`handle-branch-${idx}`"
        />
      </div>
      <!-- Default / fallback handle -->
      <div class="flex items-center justify-end gap-1 px-3 pb-2">
        <span class="text-xs text-gray-400 italic">default</span>
        <Handle
          type="source"
          :position="Position.Right"
          :id="String(switchRules.length)"
          class="!static !relative !h-3 !w-3 !transform-none !bg-gray-300 !border-white"
          data-testid="handle-branch-default"
        />
      </div>
    </template>
  </div>
</template>
