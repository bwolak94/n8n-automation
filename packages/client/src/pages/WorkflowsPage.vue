<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../shared/components/AppLayout.vue";
import {
  useWorkflowsQuery,
  useCreateWorkflow,
  useDeleteWorkflow,
} from "../shared/queries/useWorkflows.js";

const router = useRouter();

// ── Filters & pagination ─────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const search = ref("");
const statusFilter = ref("");
const page = ref(1);
const debouncedSearch = ref("");
let searchTimer: ReturnType<typeof setTimeout> | undefined;

watch(search, (val) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = val;
    page.value = 1;
  }, 300);
});

watch(statusFilter, () => { page.value = 1; });

const offset = computed(() => (page.value - 1) * PAGE_SIZE);

const queryParams = computed(() => ({
  limit: PAGE_SIZE,
  offset: offset.value,
  search: debouncedSearch.value || undefined,
  status: statusFilter.value || undefined,
}));

const { data: queryData, isPending: reactiveIsPending, isError: reactiveIsError } =
  useWorkflowsQuery(queryParams);

const workflows = computed(() => queryData.value?.items ?? []);
const total = computed(() => queryData.value?.total ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)));
const pageStart = computed(() => total.value === 0 ? 0 : offset.value + 1);
const pageEnd = computed(() => Math.min(offset.value + PAGE_SIZE, total.value));

// ── CRUD ─────────────────────────────────────────────────────────────────────
const { mutate: createWorkflow, isPending: isCreating } = useCreateWorkflow();
const { mutate: deleteWorkflow } = useDeleteWorkflow();

const showModal = ref(false);
const newName = ref("");
const deletingId = ref<string | null>(null);
const confirmDeleteId = ref<string | null>(null);

function openModal(): void {
  newName.value = "";
  showModal.value = true;
}

function handleCreate(): void {
  const name = newName.value.trim();
  if (!name) return;
  createWorkflow(
    { name, nodes: [], edges: [] },
    {
      onSuccess(workflow) {
        showModal.value = false;
        void router.push(`/workflows/${workflow.id}/canvas`);
      },
    }
  );
}

function handleDelete(id: string): void {
  deletingId.value = id;
  confirmDeleteId.value = null;
  deleteWorkflow(id, {
    onSettled() {
      deletingId.value = null;
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const statusBadge: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-500",
  active:    "bg-emerald-100 text-emerald-700",
  inactive:  "bg-amber-100 text-amber-700",
  archived:  "bg-red-100 text-red-600",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function nodeTypeSummary(nodes: { type: string }[]): string {
  if (!nodes?.length) return "—";
  const counts = nodes.reduce<Record<string, number>>((acc, n) => {
    const label = n.type.replace(/_/g, " ");
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([t, c]) => c > 1 ? `${c}× ${t}` : t).join(", ");
}
</script>

<template>
  <AppLayout>
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">Workflows</h1>
          <p class="text-sm text-gray-400">
            {{ total > 0 ? `${total} automation${total !== 1 ? "s" : ""}` : "Manage your automations" }}
          </p>
        </div>
        <button
          class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
          data-testid="create-workflow-btn"
          @click="openModal"
        >
          + New Workflow
        </button>
      </div>
    </header>

    <main class="flex flex-col flex-1 overflow-hidden">
      <!-- Filters bar -->
      <div class="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50 px-6 py-3">
        <!-- Search -->
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            v-model="search"
            type="text"
            placeholder="Search workflows…"
            class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
            aria-label="Search workflows"
          />
        </div>

        <!-- Status filter -->
        <select
          v-model="statusFilter"
          class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-300"
          aria-label="Filter by status"
        >
          <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <!-- Result count -->
        <span v-if="!reactiveIsPending" class="ml-auto text-xs text-gray-400">
          {{ total === 0 ? "No results" : `${pageStart}–${pageEnd} of ${total}` }}
        </span>
      </div>

      <!-- Table area -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="reactiveIsPending" class="flex items-center justify-center py-24">
          <div class="flex items-center gap-2 text-gray-400">
            <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
            Loading workflows…
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="reactiveIsError" class="m-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p class="text-sm text-red-600">Failed to load workflows. Please refresh.</p>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="workflows.length === 0"
          class="flex flex-col items-center justify-center py-24 text-center"
          data-testid="empty-state"
        >
          <div class="mb-4 text-5xl">⚡</div>
          <h2 class="text-lg font-semibold text-gray-700">
            {{ search || statusFilter ? "No matching workflows" : "No workflows yet" }}
          </h2>
          <p class="mt-1 text-sm text-gray-400">
            {{ search || statusFilter ? "Try adjusting your filters." : "Create your first automation to get started." }}
          </p>
          <button
            v-if="!search && !statusFilter"
            class="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            @click="openModal"
          >
            + New Workflow
          </button>
        </div>

        <!-- Table -->
        <table
          v-else
          class="w-full text-sm"
          data-testid="workflow-table"
          aria-label="Workflows"
        >
          <thead class="sticky top-0 z-10 bg-gray-50">
            <tr class="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th class="px-6 py-3 w-[40%]">Name</th>
              <th class="px-4 py-3 w-24">Status</th>
              <th class="px-4 py-3 hidden md:table-cell">Nodes</th>
              <th class="px-4 py-3 hidden lg:table-cell">Updated</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 bg-white">
            <tr
              v-for="wf in workflows"
              :key="wf.id"
              class="group hover:bg-violet-50/40 transition-colors cursor-pointer"
              data-testid="workflow-row"
              @click="router.push(`/workflows/${wf.id}/canvas`)"
            >
              <!-- Name + description -->
              <td class="px-6 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 font-bold text-sm select-none">
                    {{ wf.name.charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate font-medium text-gray-900" :title="wf.name">{{ wf.name }}</p>
                    <p
                      v-if="wf.description"
                      class="truncate text-xs text-gray-400 mt-0.5"
                      :title="wf.description"
                    >{{ wf.description }}</p>
                  </div>
                </div>
              </td>

              <!-- Status badge -->
              <td class="px-4 py-3.5">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize"
                  :class="statusBadge[wf.status] ?? 'bg-gray-100 text-gray-500'"
                >
                  {{ wf.status }}
                </span>
              </td>

              <!-- Node types -->
              <td class="px-4 py-3.5 hidden md:table-cell">
                <span class="inline-flex items-center gap-1.5 text-xs text-gray-500">
                  <span class="font-medium text-gray-700">{{ wf.nodes?.length ?? 0 }}</span>
                  <span class="hidden lg:inline truncate max-w-[180px]" :title="nodeTypeSummary(wf.nodes ?? [])">
                    {{ nodeTypeSummary(wf.nodes ?? []) }}
                  </span>
                </span>
              </td>

              <!-- Updated date -->
              <td class="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-400 whitespace-nowrap">
                {{ wf.updatedAt ? formatDate(wf.updatedAt) : "—" }}
              </td>

              <!-- Actions -->
              <td class="px-4 py-3.5 text-right" @click.stop>
                <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    class="rounded px-2.5 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-100 focus:outline-none"
                    :aria-label="`Open canvas for ${wf.name}`"
                    @click="router.push(`/workflows/${wf.id}/canvas`)"
                  >
                    Canvas
                  </button>
                  <button
                    class="rounded px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none"
                    :aria-label="`View executions for ${wf.name}`"
                    @click="router.push(`/workflows/${wf.id}/executions`)"
                  >
                    Executions
                  </button>
                  <button
                    v-if="confirmDeleteId !== wf.id"
                    class="rounded px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none"
                    :aria-label="`Delete ${wf.name}`"
                    @click="confirmDeleteId = wf.id"
                  >
                    Delete
                  </button>
                  <template v-else>
                    <span class="text-xs text-gray-500 mr-1">Sure?</span>
                    <button
                      class="rounded px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 focus:outline-none disabled:opacity-40"
                      :disabled="deletingId === wf.id"
                      @click="handleDelete(wf.id)"
                    >
                      {{ deletingId === wf.id ? "…" : "Yes, delete" }}
                    </button>
                    <button
                      class="rounded px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 focus:outline-none"
                      @click="confirmDeleteId = null"
                    >
                      Cancel
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1 || workflows.length > 0"
        class="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3"
        aria-label="Pagination"
      >
        <span class="text-xs text-gray-500">
          Page {{ page }} of {{ totalPages }}
        </span>
        <div class="flex items-center gap-1">
          <button
            class="rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page === 1"
            aria-label="Previous page"
            @click="page--"
          >
            ← Prev
          </button>

          <!-- Page numbers -->
          <template v-for="p in totalPages" :key="p">
            <button
              v-if="Math.abs(p - page) <= 2 || p === 1 || p === totalPages"
              class="rounded px-3 py-1.5 text-xs font-medium transition-colors"
              :class="p === page
                ? 'bg-violet-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'"
              :aria-current="p === page ? 'page' : undefined"
              @click="page = p"
            >
              {{ p }}
            </button>
            <span
              v-else-if="Math.abs(p - page) === 3"
              class="px-1 text-xs text-gray-400"
            >…</span>
          </template>

          <button
            class="rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="page === totalPages"
            aria-label="Next page"
            @click="page++"
          >
            Next →
          </button>
        </div>
      </div>
    </main>
  </AppLayout>

  <!-- Create Workflow Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        data-testid="create-modal"
        @click.self="showModal = false"
      >
        <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
          <h2 class="mb-1 text-lg font-semibold text-gray-900">New Workflow</h2>
          <p class="mb-4 text-sm text-gray-500">Give your automation a name to get started.</p>

          <input
            v-model="newName"
            type="text"
            placeholder="e.g. Send weekly report"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            data-testid="workflow-name-input"
            autofocus
            @keydown.enter="handleCreate"
            @keydown.esc="showModal = false"
          />

          <div class="mt-5 flex justify-end gap-2">
            <button
              class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              @click="showModal = false"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              :disabled="!newName.trim() || isCreating"
              data-testid="confirm-create-btn"
              @click="handleCreate"
            >
              {{ isCreating ? "Creating…" : "Create" }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
