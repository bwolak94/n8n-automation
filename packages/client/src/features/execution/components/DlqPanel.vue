<script setup lang="ts">
import { ref } from "vue";
import { useDlqQuery, useRetryDlqJob, useDiscardDlqJob } from "../../../shared/queries/useQueue.js";
import type { DlqEntry } from "../../../shared/types/index.js";

const { data, isPending, isError } = useDlqQuery();
const { mutate: retry, isPending: isRetrying } = useRetryDlqJob();
const { mutate: discard, isPending: isDiscarding } = useDiscardDlqJob();

const confirmDiscardId = ref<string | null>(null);

function handleRetry(jobId: string): void {
  retry(jobId);
}

function requestDiscard(jobId: string): void {
  confirmDiscardId.value = jobId;
}

function confirmDiscard(): void {
  if (!confirmDiscardId.value) return;
  discard(confirmDiscardId.value, {
    onSettled: () => {
      confirmDiscardId.value = null;
    },
  });
}

function cancelDiscard(): void {
  confirmDiscardId.value = null;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString();
}

function workflowName(entry: DlqEntry): string {
  const data = entry.data as Record<string, unknown> | null;
  if (data && typeof data["workflowName"] === "string") return data["workflowName"];
  if (data && typeof data["workflowId"] === "string") return `Workflow ${data["workflowId"]}`;
  return entry.id;
}
</script>

<template>
  <section class="flex flex-col" data-testid="dlq-panel">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-base font-semibold text-gray-800">Dead Letter Queue</h2>
      <span v-if="data" class="text-xs text-gray-400">{{ data.total }} job{{ data.total !== 1 ? "s" : "" }}</span>
    </div>

    <!-- Loading -->
    <div v-if="isPending" class="flex items-center justify-center py-12" data-testid="dlq-loading">
      <svg class="h-6 w-6 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="isError" class="rounded-lg border border-red-200 bg-red-50 p-4">
      <p class="text-sm text-red-600">Failed to load DLQ entries.</p>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!data?.items?.length"
      class="flex flex-col items-center py-12 text-center"
      data-testid="dlq-empty"
    >
      <p class="text-sm text-gray-400">No failed jobs in the queue.</p>
    </div>

    <!-- List -->
    <div v-else class="space-y-3" data-testid="dlq-list">
      <div
        v-for="entry in data.items"
        :key="entry.id"
        class="rounded-xl border border-gray-200 bg-white p-4"
        data-testid="dlq-entry"
      >
        <div class="mb-2 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-gray-800" :title="workflowName(entry)" data-testid="dlq-workflow-name">
              {{ workflowName(entry) }}
            </p>
            <p class="mt-0.5 text-xs text-red-500" data-testid="dlq-error">{{ entry.errorMessage }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              class="rounded border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isRetrying"
              data-testid="dlq-retry-btn"
              @click="handleRetry(entry.id)"
            >
              Retry
            </button>
            <button
              type="button"
              class="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isDiscarding && confirmDiscardId === entry.id"
              data-testid="dlq-discard-btn"
              @click="requestDiscard(entry.id)"
            >
              Discard
            </button>
          </div>
        </div>
        <div class="flex gap-4 text-xs text-gray-400">
          <span data-testid="dlq-retry-count">Attempts: {{ entry.retryCount }}</span>
          <span data-testid="dlq-failed-at">Last attempt: {{ formatDate(entry.failedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Discard confirmation dialog (Teleport to body) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="confirmDiscardId"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="discard-confirm-dialog"
          @click.self="cancelDiscard"
        >
          <div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 class="mb-2 text-base font-semibold text-gray-900">Discard failed job?</h3>
            <p class="mb-5 text-sm text-gray-500">
              This will permanently delete the job from the dead letter queue. It cannot be recovered.
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                data-testid="discard-cancel"
                @click="cancelDiscard"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                :disabled="isDiscarding"
                data-testid="discard-confirm"
                @click="confirmDiscard"
              >
                {{ isDiscarding ? "Discarding…" : "Discard" }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>
