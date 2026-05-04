<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";
import BaseNodeCard from "./BaseNodeCard.vue";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: {
    transport?: string;
    to?: string;
    subject?: string;
    from?: string;
    dryRun?: boolean;
  };
}

const props = defineProps<NodeProps<NodeData>>();

const transportIcon: Record<string, string> = {
  smtp: "📧",
  sendgrid: "✉️",
};

const icon = transportIcon[props.data.config.transport ?? "smtp"] ?? "📧";
</script>

<template>
  <BaseNodeCard
    :label="props.data.label"
    :icon="icon"
    :status="props.data.status"
    :category="props.data.category"
    data-testid="email-node-card"
  >
    <div class="space-y-0.5 px-3 pb-2 text-xs text-gray-400">
      <div v-if="props.data.config.to" class="truncate">
        <span class="font-medium text-gray-500">To:</span> {{ props.data.config.to }}
      </div>
      <div v-if="props.data.config.subject" class="truncate">
        <span class="font-medium text-gray-500">Subject:</span> {{ props.data.config.subject }}
      </div>
      <div v-if="props.data.config.transport" class="capitalize">
        {{ props.data.config.transport }}
        <span v-if="props.data.config.dryRun" class="ml-1 text-amber-400">(dry run)</span>
      </div>
    </div>
  </BaseNodeCard>
</template>
