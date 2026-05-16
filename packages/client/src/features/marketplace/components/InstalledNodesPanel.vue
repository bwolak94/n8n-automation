<script setup lang="ts">
import type { InstalledNode } from "../../../shared/api/marketplace.js";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  installedNodes: InstalledNode[];
  loading?: boolean;
  uninstalling?: string | null; // packageId currently being uninstalled
}

withDefaults(defineProps<Props>(), {
  loading: false,
  uninstalling: null,
});

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  uninstall: [packageId: string];
}>();

function onUninstall(packageId: string): void {
  emit("uninstall", packageId);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
</script>

<template>
  <div data-testid="installed-nodes-panel">
    <h2 class="mb-4 text-base font-semibold text-gray-800">Installed Nodes</h2>

    <!-- Skeleton -->
    <div v-if="loading" class="space-y-3" data-testid="installed-skeleton">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-xl bg-gray-100" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="installedNodes.length === 0"
      class="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400"
      data-testid="installed-empty"
    >
      No nodes installed yet.
    </div>

    <!-- Node list -->
    <ul v-else class="space-y-2" role="list">
      <li
        v-for="node in installedNodes"
        :key="node.packageId"
        class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
        data-testid="installed-node-row"
      >
        <div>
          <p class="text-sm font-medium text-gray-800" data-testid="installed-node-type">
            {{ node.nodeType }}
          </p>
          <p class="text-xs text-gray-400">
            <span data-testid="installed-node-version">v{{ node.version }}</span>
            &nbsp;·&nbsp;
            <span data-testid="installed-node-date">Installed {{ formatDate(node.installedAt) }}</span>
          </p>
        </div>

        <button
          class="rounded-lg border border-red-100 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="uninstalling === node.packageId"
          data-testid="uninstall-button"
          :aria-label="`Uninstall ${node.nodeType}`"
          @click="onUninstall(node.packageId)"
        >
          {{ uninstalling === node.packageId ? "Removing…" : "Uninstall" }}
        </button>
      </li>
    </ul>
  </div>
</template>
