<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useWorkflowQuery } from "../shared/queries/useWorkflows.js";
import ExecutionListView from "../features/execution/components/ExecutionListView.vue";
import ExecutionLogPanel from "../features/execution/components/ExecutionLogPanel.vue";
import DlqPanel from "../features/execution/components/DlqPanel.vue";
import SchedulerPanel from "../features/execution/components/SchedulerPanel.vue";

type Tab = "executions" | "dlq" | "scheduler";

const route = useRoute();
const workflowId = computed(() => route.params["id"] as string);
const { data: workflow } = useWorkflowQuery(workflowId.value);

const activeTab = ref<Tab>("executions");
const selectedExecutionId = ref<string | null>(null);

const showLogPanel = computed(() => !!selectedExecutionId.value && activeTab.value === "executions");

function selectExecution(id: string): void {
  selectedExecutionId.value = id;
}

function closeLogPanel(): void {
  selectedExecutionId.value = null;
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-50">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
      <div class="mx-auto flex max-w-7xl items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Automation Hub</h1>
          <p class="text-sm text-gray-500">
            {{ workflow?.name ?? "Workflow" }} — Monitoring
          </p>
        </div>
        <nav class="flex gap-1" aria-label="Monitoring tabs">
          <button
            v-for="tab in (['executions', 'dlq', 'scheduler'] as Tab[])"
            :key="tab"
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors"
            :class="activeTab === tab
              ? 'bg-violet-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'"
            :data-testid="`tab-${tab}`"
            @click="activeTab = tab; selectedExecutionId = null"
          >
            {{ tab === 'dlq' ? 'Dead Letter Queue' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
          </button>
        </nav>
      </div>
    </header>

    <!-- Main layout -->
    <main class="flex flex-1 overflow-hidden">
      <div
        class="flex-1 overflow-y-auto p-6 transition-all"
        :class="showLogPanel ? 'max-w-[calc(100%-24rem)]' : 'max-w-full'"
      >
        <div class="mx-auto max-w-5xl">
          <!-- Executions tab -->
          <ExecutionListView
            v-if="activeTab === 'executions' && workflowId"
            :workflow-id="workflowId"
            :workflow-name="workflow?.name"
            @select="selectExecution"
          />

          <!-- DLQ tab -->
          <DlqPanel v-else-if="activeTab === 'dlq'" />

          <!-- Scheduler tab -->
          <SchedulerPanel
            v-else-if="activeTab === 'scheduler' && workflowId"
            :workflow-id="workflowId"
            :initial-schedule="workflow?.schedule"
          />
        </div>
      </div>

      <!-- Log panel slide-in -->
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform duration-150 ease-in"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div v-if="showLogPanel" class="w-96 shrink-0 border-l border-gray-200 bg-white">
          <ExecutionLogPanel
            :execution-id="selectedExecutionId"
            @close="closeLogPanel"
          />
        </div>
      </Transition>
    </main>
  </div>
</template>
