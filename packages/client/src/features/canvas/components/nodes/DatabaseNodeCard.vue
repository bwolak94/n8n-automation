<script setup lang="ts">
import type { NodeProps } from "@vue-flow/core";
import BaseNodeCard from "./BaseNodeCard.vue";

interface NodeData {
  label: string;
  status?: "idle" | "running" | "success" | "error";
  category: string;
  config: {
    dialect?: "postgres" | "mysql" | "sqlite";
    operation?: string;
    sql?: string;
    maxRows?: number;
    transaction?: boolean;
  };
}

const props = defineProps<NodeProps<NodeData>>();

const dialectIcon: Record<string, string> = {
  postgres: "🐘",
  mysql:    "🐬",
  sqlite:   "🗃️",
};

const icon = dialectIcon[props.data.config.dialect ?? "postgres"] ?? "🗄️";

const sqlPreview = props.data.config.sql
  ? props.data.config.sql.slice(0, 60) + (props.data.config.sql.length > 60 ? "…" : "")
  : null;
</script>

<template>
  <BaseNodeCard
    :label="props.data.label"
    :icon="icon"
    :status="props.data.status"
    :category="props.data.category"
    data-testid="database-node-card"
  >
    <div class="space-y-0.5 px-3 pb-2 text-xs text-gray-400">
      <div v-if="props.data.config.dialect" class="capitalize font-medium text-gray-500">
        {{ props.data.config.dialect }}
        <span v-if="props.data.config.operation" class="ml-1 font-normal">
          · {{ props.data.config.operation }}
        </span>
      </div>
      <div v-if="sqlPreview" class="truncate font-mono">
        {{ sqlPreview }}
      </div>
      <div class="flex gap-2">
        <span v-if="props.data.config.maxRows" class="text-gray-500">
          max {{ props.data.config.maxRows }} rows
        </span>
        <span v-if="props.data.config.transaction" class="text-amber-400">
          transaction
        </span>
      </div>
    </div>
  </BaseNodeCard>
</template>
