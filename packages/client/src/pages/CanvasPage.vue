<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
import { useCanvasStore } from "../stores/canvasStore.js";
import { useAuthStore } from "../stores/authStore.js";
import { useWorkflowQuery, useExecuteWorkflow } from "../shared/queries/useWorkflows.js";
import { useNodeRegistryStore } from "../stores/nodeRegistryStore.js";
import { useNodeDefinitionsQuery } from "../shared/queries/useNodes.js";
import { fetchWorkflowExecutions } from "../shared/api/executions.js";
import { useDebugSession } from "../features/canvas/composables/useDebugSession.js";
import type { ExecutionSummary } from "../shared/types/index.js";
import WorkflowCanvas from "../features/canvas/components/WorkflowCanvas.vue";
import NodePalette from "../features/canvas/components/NodePalette.vue";
import NodeConfigPanel from "../features/canvas/components/NodeConfigPanel.vue";
import CanvasToolbar from "../features/canvas/components/CanvasToolbar.vue";
import ExecutionLogPanel from "../features/execution/components/ExecutionLogPanel.vue";
import DebugPanel from "../features/canvas/components/DebugPanel.vue";
import WorkflowVersionPanel from "../features/canvas/components/WorkflowVersionPanel.vue";

const route = useRoute();
const canvasStore = useCanvasStore();
const authStore = useAuthStore();
const canvasRef = ref<InstanceType<typeof WorkflowCanvas> | null>(null);
const registryStore = useNodeRegistryStore();

const workflowId = route.params["id"] as string;
const { data: workflow, isPending, refetch: refetchWorkflow } = useWorkflowQuery(workflowId);
const { data: nodeDefs } = useNodeDefinitionsQuery();
const { mutate: executeWorkflow, isPending: isExecuting } = useExecuteWorkflow();

// ── Execution panel ──────────────────────────────────────────────────────────

const showExecPanel = ref(false);
const trackedExecutionId = ref<string | null>(null);

const { data: recentExecutions } = useQuery({
  queryKey: ["executions", "workflow", workflowId, "recent"],
  queryFn: () => fetchWorkflowExecutions(workflowId, 1, 0),
  enabled: () => showExecPanel.value && !trackedExecutionId.value,
  refetchInterval: (query) => {
    const items = (query.state.data as { items: ExecutionSummary[] } | undefined)?.items;
    return items && items.length > 0 ? false : 1000;
  },
});

watch(recentExecutions, (data) => {
  if (data?.items[0] && !trackedExecutionId.value) {
    trackedExecutionId.value = data.items[0].id;
  }
});

// ── Canvas load ──────────────────────────────────────────────────────────────

watch(workflow, (wf) => {
  if (wf) canvasStore.loadWorkflow(wf);
}, { immediate: true });

watch(nodeDefs, (defs) => {
  if (defs && !registryStore.isLoaded) registryStore.setDefinitions(defs.items);
}, { immediate: true });

// ── Debug session ────────────────────────────────────────────────────────────

const showDebugPanel = ref(false);
const debugPanelRef = ref<InstanceType<typeof DebugPanel> | null>(null);

const debugSession = useDebugSession(
  authStore.token ?? "",
  authStore.user?.tenantId ?? "",
);

function handleDebugRun(): void {
  const triggerData = debugPanelRef.value?.parsedTriggerData() ?? {};
  debugSession.start({
    workflowId,
    triggerData,
    breakpoints: [...debugSession.breakpoints],
  });
}

function handleDebugStep(): void {
  debugSession.stepOver();
}

function handleDebugCancel(): void {
  debugSession.cancel();
}

function handleDebugMock(nodeId: string, mockData: unknown): void {
  debugSession.setMockOutput(nodeId, mockData);
}

// ── Version history ──────────────────────────────────────────────────────────

const showVersionPanel = ref(false);

async function handleVersionRestored(): Promise<void> {
  await refetchWorkflow();
  if (workflow.value) canvasStore.loadWorkflow(workflow.value);
}

// ── Toolbar actions ──────────────────────────────────────────────────────────

async function handleSave(): Promise<void> {
  await canvasStore.saveWorkflow();
}

function handleExecute(): void {
  if (!canvasStore.workflowId) return;
  canvasStore.saveWorkflow().then(() => {
    trackedExecutionId.value = null;
    showExecPanel.value = true;
    executeWorkflow(
      { id: canvasStore.workflowId! },
      { onError: () => { showExecPanel.value = false; } },
    );
  }).catch(() => undefined);
}

function handleZoomIn(): void { canvasRef.value?.zoomIn(); }
function handleZoomOut(): void { canvasRef.value?.zoomOut(); }
function handleFitView(): void { canvasRef.value?.fitView(); }
</script>

<template>
  <div class="relative flex h-screen flex-col overflow-hidden" data-testid="canvas-page">
    <!-- Toolbar -->
    <CanvasToolbar
      @save="handleSave"
      @execute="handleExecute"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @fit-view="handleFitView"
    >
      <template #actions>
        <button
          class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          :class="showDebugPanel
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'"
          data-testid="toggle-debug-panel"
          @click="showDebugPanel = !showDebugPanel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          Debug
        </button>
        <button
          class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
          :class="showVersionPanel
            ? 'border-violet-300 bg-violet-50 text-violet-700'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'"
          data-testid="toggle-version-panel"
          @click="showVersionPanel = !showVersionPanel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
          </svg>
          History
        </button>
      </template>
    </CanvasToolbar>

    <!-- Loading -->
    <div
      v-if="isPending"
      class="flex flex-1 items-center justify-center text-gray-500"
      data-testid="canvas-loading"
    >
      Loading canvas…
    </div>

    <!-- Canvas layout -->
    <div v-else class="relative flex flex-1 overflow-hidden">
      <!-- Left: node palette -->
      <NodePalette />

      <!-- Center: canvas -->
      <WorkflowCanvas ref="canvasRef" class="flex-1" :workflow-id="workflowId" />

      <!-- Right: config panel (absolute overlay) -->
      <NodeConfigPanel />

      <!-- Right: execution log panel -->
      <div
        v-if="showExecPanel"
        class="w-80 shrink-0 border-l border-gray-200"
        data-testid="execution-panel-wrapper"
      >
        <ExecutionLogPanel
          :execution-id="trackedExecutionId"
          @close="showExecPanel = false"
        />
      </div>

      <!-- Right: debug panel -->
      <DebugPanel
        v-if="showDebugPanel"
        ref="debugPanelRef"
        :status="debugSession.status.value"
        :error-message="debugSession.errorMessage.value"
        :node-states="debugSession.nodeStates"
        :selected-node-id="canvasStore.selectedNodeId"
        @run="handleDebugRun"
        @step="handleDebugStep"
        @cancel="handleDebugCancel"
        @mock="handleDebugMock"
      />

      <!-- Right: version history panel -->
      <WorkflowVersionPanel
        v-if="showVersionPanel"
        :workflow-id="workflowId"
        @close="showVersionPanel = false"
        @restored="handleVersionRestored"
      />
    </div>

    <!-- Executing indicator -->
    <div
      v-if="isExecuting"
      class="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm text-white shadow-lg"
      data-testid="executing-indicator"
    >
      <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      Queueing…
    </div>
  </div>
</template>
