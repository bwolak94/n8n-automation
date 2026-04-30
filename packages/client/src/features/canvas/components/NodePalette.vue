<script setup lang="ts">
import { computed, ref } from "vue";
import { useNodeRegistryStore } from "../../../stores/nodeRegistryStore.js";
import type { NodeDefinition } from "../../../shared/types/index.js";

const registryStore = useNodeRegistryStore();
const search = ref("");

const categoryLabels: Record<string, string> = {
  triggers: "Triggers",
  actions: "Actions",
  logic: "Logic",
  data: "Data",
  ai: "AI",
  communication: "Communication",
  integrations: "Integrations",
};

const categoryIcons: Record<string, string> = {
  triggers: "⚡",
  actions: "🔧",
  logic: "🔀",
  data: "📊",
  ai: "🤖",
  communication: "📧",
  integrations: "🔗",
};

const filteredGroups = computed(() => {
  const query = search.value.toLowerCase();
  return Object.entries(registryStore.byCategory)
    .map(([category, defs]) => ({
      category,
      label: categoryLabels[category] ?? category,
      icon: categoryIcons[category] ?? "📦",
      defs: query
        ? defs.filter(
            (d) =>
              d.label.toLowerCase().includes(query) ||
              (d.description ?? "").toLowerCase().includes(query)
          )
        : defs,
    }))
    .filter((g) => g.defs.length > 0);
});

function onDragStart(event: DragEvent, def: NodeDefinition): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData("application/node-type", def.type);
  event.dataTransfer.setData("application/node-label", def.label);
  event.dataTransfer.setData("application/node-category", def.category);
  event.dataTransfer.effectAllowed = "copy";
}
</script>

<template>
  <aside
    class="flex h-full w-56 flex-col border-r border-gray-200 bg-white"
    data-testid="node-palette"
    aria-label="Node palette"
  >
    <!-- Search -->
    <div class="border-b border-gray-100 px-3 py-2">
      <input
        v-model="search"
        type="search"
        placeholder="Search nodes…"
        class="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
        data-testid="palette-search"
        aria-label="Search nodes"
      />
    </div>

    <!-- Loading state -->
    <div
      v-if="!registryStore.isLoaded"
      class="flex flex-1 items-center justify-center text-sm text-gray-400"
      data-testid="palette-loading"
    >
      Loading nodes…
    </div>

    <!-- Grouped node list -->
    <div v-else class="flex-1 overflow-y-auto pb-4">
      <div
        v-for="group in filteredGroups"
        :key="group.category"
        :data-testid="`palette-group-${group.category}`"
      >
        <div class="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
          {{ group.icon }} {{ group.label }}
        </div>

        <div
          v-for="def in group.defs"
          :key="def.type"
          class="mx-2 mb-1 flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-violet-50 active:cursor-grabbing"
          :data-testid="`palette-node-${def.type}`"
          :title="def.description"
          draggable="true"
          @dragstart="onDragStart($event, def)"
        >
          <span class="text-base leading-none" aria-hidden="true">{{ def.icon || categoryIcons[def.category] || '📦' }}</span>
          <span class="truncate">{{ def.label }}</span>
        </div>
      </div>

      <p
        v-if="registryStore.isLoaded && filteredGroups.length === 0"
        class="px-3 py-4 text-sm text-gray-400"
        data-testid="palette-empty"
      >
        No nodes found
      </p>
    </div>
  </aside>
</template>
