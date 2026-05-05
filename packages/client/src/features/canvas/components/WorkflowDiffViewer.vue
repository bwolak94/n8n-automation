<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

interface JsonPatchOp {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

const props = defineProps<{
  workflowId: string;
  v1: number;
  v2: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const ops = ref<JsonPatchOp[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const addedOps = computed(() => ops.value.filter((o) => o.op === "add"));
const removedOps = computed(() => ops.value.filter((o) => o.op === "remove"));
const changedOps = computed(() => ops.value.filter((o) => o.op === "replace"));

async function fetchDiff(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({ v1: String(props.v1), v2: String(props.v2) });
    const res = await fetch(
      `/api/workflows/${props.workflowId}/versions/diff?${params}`,
      { headers: { "X-Tenant-Id": getTenantId() } }
    );
    if (!res.ok) throw new Error(`Diff failed: ${res.status}`);
    ops.value = (await res.json()) as JsonPatchOp[];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  } finally {
    loading.value = false;
  }
}

function formatValue(value: unknown): string {
  if (value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function getTenantId(): string {
  return (document.querySelector('meta[name="tenant-id"]') as HTMLMetaElement | null)
    ?.content ?? "";
}

onMounted(fetchDiff);
</script>

<template>
  <div
    class="flex h-full flex-col bg-white"
    aria-label="Version diff viewer"
    data-testid="diff-viewer"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <h2 class="text-sm font-semibold text-gray-800">
        Diff: v{{ props.v1 }} → v{{ props.v2 }}
      </h2>
      <button
        class="text-gray-400 hover:text-gray-600"
        aria-label="Close diff viewer"
        data-testid="close-btn"
        @click="emit('close')"
      >
        ✕
      </button>
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
      Computing diff…
    </div>

    <!-- No changes -->
    <div
      v-else-if="!loading && ops.length === 0"
      class="flex flex-1 items-center justify-center text-sm text-gray-400"
      data-testid="no-changes"
    >
      No differences between v{{ props.v1 }} and v{{ props.v2 }}.
    </div>

    <!-- Diff summary -->
    <div v-else class="flex-1 overflow-y-auto divide-y divide-gray-100">
      <!-- Stats bar -->
      <div class="flex gap-4 px-4 py-2 bg-gray-50 text-xs">
        <span class="text-green-600 font-medium" data-testid="added-count">
          +{{ addedOps.length }} added
        </span>
        <span class="text-red-600 font-medium" data-testid="removed-count">
          -{{ removedOps.length }} removed
        </span>
        <span class="text-yellow-600 font-medium" data-testid="changed-count">
          ~{{ changedOps.length }} changed
        </span>
      </div>

      <!-- Operations list -->
      <ul class="divide-y divide-gray-100" aria-label="Change operations">
        <li
          v-for="(op, idx) in ops"
          :key="idx"
          class="px-4 py-2"
          :data-testid="`op-${idx}`"
          :class="{
            'bg-green-50': op.op === 'add',
            'bg-red-50': op.op === 'remove',
            'bg-yellow-50': op.op === 'replace',
          }"
        >
          <div class="flex items-start gap-2">
            <!-- Op badge -->
            <span
              class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              :class="{
                'bg-green-200 text-green-800': op.op === 'add',
                'bg-red-200 text-red-800': op.op === 'remove',
                'bg-yellow-200 text-yellow-800': op.op === 'replace',
              }"
            >
              {{ op.op }}
            </span>

            <div class="min-w-0 flex-1">
              <!-- Path -->
              <p
                class="font-mono text-xs text-gray-700 break-all"
                data-testid="op-path"
              >
                {{ op.path }}
              </p>

              <!-- Value for add/replace -->
              <pre
                v-if="op.op !== 'remove' && op.value !== undefined"
                class="mt-1 max-h-24 overflow-auto rounded bg-black/5 p-1 font-mono text-[10px] text-gray-700"
                data-testid="op-value"
              >{{ formatValue(op.value) }}</pre>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
