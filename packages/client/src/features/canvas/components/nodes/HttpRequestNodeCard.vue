<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";
import BaseNodeCard from "./BaseNodeCard.vue";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: Record<string, unknown>;
}

const props = defineProps<NodeProps<NodeData>>();
</script>

<template>
  <BaseNodeCard
    :label="props.data.label"
    icon="🌐"
    :status="props.data.status"
    :category="props.data.category"
    data-testid="http-request-node"
  >
    <div v-if="props.data.config['url']" class="truncate px-3 pb-2 text-xs text-gray-400">
      {{ props.data.config['url'] }}
    </div>
  </BaseNodeCard>
</template>
