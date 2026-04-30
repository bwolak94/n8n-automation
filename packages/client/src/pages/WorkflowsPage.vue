<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../shared/components/AppLayout.vue";
import {
  useWorkflowsQuery,
  useCreateWorkflow,
  useDeleteWorkflow,
} from "../shared/queries/useWorkflows.js";

const router = useRouter();
const { data, isPending, isError } = useWorkflowsQuery();
const { mutate: createWorkflow, isPending: isCreating } = useCreateWorkflow();
const { mutate: deleteWorkflow } = useDeleteWorkflow();

const showModal = ref(false);
const newName = ref("");
const deletingId = ref<string | null>(null);

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
  deleteWorkflow(id, {
    onSettled() {
      deletingId.value = null;
    },
  });
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-500",
  active: "bg-green-100 text-green-700",
  inactive: "bg-yellow-100 text-yellow-700",
  archived: "bg-red-100 text-red-600",
};
</script>

<template>
  <AppLayout>
    <!-- Top bar -->
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">Workflows</h1>
          <p class="text-sm text-gray-400">Manage your automation workflows</p>
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

    <main class="flex-1 overflow-y-auto p-6">
      <!-- Loading -->
      <div v-if="isPending" class="flex items-center justify-center py-24">
        <p class="text-gray-400">Loading workflows…</p>
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="rounded-lg border border-red-200 bg-red-50 p-4">
        <p class="text-sm text-red-600">Failed to load workflows. Please refresh.</p>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!data?.items?.length"
        class="flex flex-col items-center justify-center py-24 text-center"
        data-testid="empty-state"
      >
        <div class="mb-4 text-5xl">⚡</div>
        <h2 class="text-lg font-semibold text-gray-700">No workflows yet</h2>
        <p class="mt-1 text-sm text-gray-400">Create your first automation to get started.</p>
        <button
          class="mt-6 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          @click="openModal"
        >
          + New Workflow
        </button>
      </div>

      <!-- Workflow grid -->
      <div
        v-else
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="workflow-list"
      >
        <div
          v-for="workflow in data.items"
          :key="workflow.id"
          class="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          data-testid="workflow-card"
        >
          <!-- Card header -->
          <div class="mb-3 flex items-start justify-between gap-2">
            <h2
              class="flex-1 truncate text-base font-semibold text-gray-900"
              :title="workflow.name"
            >
              {{ workflow.name }}
            </h2>
            <span
              class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
              :class="statusColors[workflow.status] ?? 'bg-gray-100 text-gray-500'"
            >
              {{ workflow.status }}
            </span>
          </div>

          <!-- Description -->
          <p
            v-if="workflow.description"
            class="mb-3 truncate text-sm text-gray-400"
            :title="workflow.description"
          >
            {{ workflow.description }}
          </p>

          <!-- Node count -->
          <p class="mb-4 text-xs text-gray-400">
            {{ workflow.nodes?.length ?? 0 }} node{{ (workflow.nodes?.length ?? 0) !== 1 ? "s" : "" }}
          </p>

          <!-- Actions -->
          <div class="mt-auto grid grid-cols-2 gap-2">
            <button
              class="col-span-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none"
              data-testid="open-canvas-btn"
              @click="router.push(`/workflows/${workflow.id}/canvas`)"
            >
              Open Canvas
            </button>
            <button
              class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 focus:outline-none"
              data-testid="open-executions-btn"
              @click="router.push(`/workflows/${workflow.id}/executions`)"
            >
              Executions
            </button>
            <button
              class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="deletingId === workflow.id"
              data-testid="delete-workflow-btn"
              :aria-label="`Delete ${workflow.name}`"
              @click="handleDelete(workflow.id)"
            >
              {{ deletingId === workflow.id ? "…" : "Delete" }}
            </button>
          </div>
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
