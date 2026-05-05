<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

interface VersionSummary {
  id: string;
  workflowId: string;
  tenantId: string;
  version: number;
  label?: string;
  createdBy: string;
  createdAt: string;
  autoSave: boolean;
}

const props = defineProps<{
  workflowId: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "restored", version: VersionSummary): void;
  (e: "compare", v1: number, v2: number): void;
}>();

const versions = ref<VersionSummary[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedForCompare = ref<number[]>([]);
const restoringVersion = ref<number | null>(null);

async function fetchVersions(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`/api/workflows/${props.workflowId}/versions`, {
      headers: { "X-Tenant-Id": getTenantId() },
    });
    if (!res.ok) throw new Error(`Failed to load versions: ${res.status}`);
    versions.value = (await res.json()) as VersionSummary[];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  } finally {
    loading.value = false;
  }
}

async function restore(version: number): Promise<void> {
  restoringVersion.value = version;
  try {
    const res = await fetch(
      `/api/workflows/${props.workflowId}/versions/${version}/restore`,
      {
        method: "POST",
        headers: { "X-Tenant-Id": getTenantId() },
      }
    );
    if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
    const newVersion = (await res.json()) as VersionSummary;
    await fetchVersions();
    emit("restored", newVersion);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Restore failed";
  } finally {
    restoringVersion.value = null;
  }
}

function toggleCompareSelect(version: number): void {
  const idx = selectedForCompare.value.indexOf(version);
  if (idx >= 0) {
    selectedForCompare.value.splice(idx, 1);
  } else if (selectedForCompare.value.length < 2) {
    selectedForCompare.value.push(version);
  } else {
    // Replace the oldest selection
    selectedForCompare.value = [selectedForCompare.value[1]!, version];
  }
}

function triggerCompare(): void {
  if (selectedForCompare.value.length === 2) {
    const [v1, v2] = selectedForCompare.value.sort((a, b) => a - b);
    emit("compare", v1!, v2!);
  }
}

const canCompare = computed(() => selectedForCompare.value.length === 2);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTenantId(): string {
  // Reads tenant id from meta tag injected by the app shell
  return (document.querySelector('meta[name="tenant-id"]') as HTMLMetaElement | null)
    ?.content ?? "";
}

onMounted(fetchVersions);
</script>

<template>
  <aside
    class="flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-lg"
    aria-label="Workflow version history"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <h2 class="text-sm font-semibold text-gray-800">Version History</h2>
      <div class="flex items-center gap-2">
        <button
          v-if="canCompare"
          class="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          data-testid="compare-btn"
          @click="triggerCompare"
        >
          Compare ({{ selectedForCompare[0] }} vs {{ selectedForCompare[1] }})
        </button>
        <button
          class="text-gray-400 hover:text-gray-600"
          aria-label="Close version panel"
          data-testid="close-btn"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="mx-4 mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600"
      role="alert"
      data-testid="error-msg"
    >
      {{ error }}
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center text-sm text-gray-400"
      data-testid="loading"
    >
      Loading…
    </div>

    <!-- Version list -->
    <ol
      v-else
      class="flex-1 overflow-y-auto divide-y divide-gray-100"
      aria-label="Versions"
    >
      <li
        v-for="v in versions"
        :key="v.version"
        class="group relative px-4 py-3 hover:bg-gray-50"
        :data-testid="`version-${v.version}`"
      >
        <!-- Compare checkbox -->
        <input
          type="checkbox"
          class="absolute left-2 top-4 h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600"
          :checked="selectedForCompare.includes(v.version)"
          :aria-label="`Select v${v.version} for comparison`"
          @change="toggleCompareSelect(v.version)"
        />

        <div class="ml-4">
          <!-- Version number + badge -->
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-gray-700">v{{ v.version }}</span>
            <span
              v-if="!v.autoSave"
              class="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
              data-testid="release-badge"
            >
              release
            </span>
            <span
              v-else
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
              data-testid="autosave-badge"
            >
              auto
            </span>
          </div>

          <!-- Label -->
          <p
            v-if="v.label"
            class="mt-0.5 text-xs font-medium text-gray-800 truncate"
            data-testid="version-label"
          >
            {{ v.label }}
          </p>

          <!-- Meta -->
          <p class="mt-0.5 text-[11px] text-gray-400">
            {{ formatDate(v.createdAt) }} · {{ v.createdBy }}
          </p>
        </div>

        <!-- Restore button -->
        <button
          class="absolute right-3 top-3 hidden rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:border-gray-400 group-hover:block"
          :disabled="restoringVersion === v.version"
          :data-testid="`restore-${v.version}`"
          @click="restore(v.version)"
        >
          {{ restoringVersion === v.version ? "…" : "Restore" }}
        </button>
      </li>

      <li
        v-if="!loading && versions.length === 0"
        class="px-4 py-6 text-center text-sm text-gray-400"
        data-testid="empty-state"
      >
        No versions yet. Save the workflow to create one.
      </li>
    </ol>
  </aside>
</template>
