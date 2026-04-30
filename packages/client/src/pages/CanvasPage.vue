<script setup lang="ts">
import { ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useRoute } from "vue-router";
import { useCanvasStore } from "../stores/canvasStore.js";
import { useWorkflowQuery } from "../shared/queries/useWorkflows.js";
import { useExecuteWorkflow } from "../shared/queries/useWorkflows.js";
import { useNodeRegistryStore } from "../stores/nodeRegistryStore.js";
import { useNodeDefinitionsQuery } from "../shared/queries/useNodes.js";
import { fetchWorkflowExecutions } from "../shared/api/executions.js";
import type { ExecutionSummary } from "../shared/types/index.js";
import WorkflowCanvas from "../features/canvas/components/WorkflowCanvas.vue";
import NodePalette from "../features/canvas/components/NodePalette.vue";
import NodeConfigPanel from "../features/canvas/components/NodeConfigPanel.vue";
import CanvasToolbar from "../features/canvas/components/CanvasToolbar.vue";
import ExecutionLogPanel from "../features/execution/components/ExecutionLogPanel.vue";

const route = useRoute();
const canvasStore = useCanvasStore();
const canvasRef = ref<InstanceType<typeof WorkflowCanvas> | null>(null);
const registryStore = useNodeRegistryStore();

const workflowId = route.params["id"] as string;
const { data: workflow, isPending } = useWorkflowQuery(workflowId);
const { data: nodeDefs } = useNodeDefinitionsQuery();
const { mutate: executeWorkflow, isPending: isExecuting } = useExecuteWorkflow();

// Execution panel state
const showExecPanel = ref(false);
const trackedExecutionId = ref<string | null>(null);

// Poll recent executions while the panel is open and no ID is tracked yet
const { data: recentExecutions } = useQuery({
  queryKey: ["executions", "workflow", workflowId, "recent"],
  queryFn: () => fetchWorkflowExecutions(workflowId, 1, 0),
  enabled: () => showExecPanel.value && !trackedExecutionId.value,
  refetchInterval: (query) => {
    const items = (query.state.data as { items: ExecutionSummary[] } | undefined)?.items;
    return items && items.length > 0 ? false : 1000;
  },
});

// Once we find the execution ID, track it and stop polling the list
watch(recentExecutions, (data) => {
  if (data?.items[0] && !trackedExecutionId.value) {
    trackedExecutionId.value = data.items[0].id;
  }
});

// Populate canvas when workflow loads
watch(workflow, (wf) => {
  if (wf) canvasStore.loadWorkflow(wf);
}, { immediate: true });

// Populate node registry when definitions load
watch(nodeDefs, (defs) => {
  if (defs && !registryStore.isLoaded) registryStore.setDefinitions(defs.items);
}, { immediate: true });

async function handleSave(): Promise<void> {
  await canvasStore.saveWorkflow();
}

function handleExecute(): void {
  if (!canvasStore.workflowId) return;
  // Save first so the worker sees the latest nodes/edges
  canvasStore.saveWorkflow().then(() => {
    trackedExecutionId.value = null;
    showExecPanel.value = true;
    executeWorkflow(
      { id: canvasStore.workflowId! },
      {
        onError: () => {
          showExecPanel.value = false;
        },
      }
    );
  }).catch(() => undefined);
}

function handleZoomIn(): void { canvasRef.value?.zoomIn(); }
function handleZoomOut(): void { canvasRef.value?.zoomOut(); }
function handleFitView(): void { canvasRef.value?.fitView(); }
</script>

<template>
  <div class="relative flex h-screen flex-col overflow-hidden" data-testid="canvas-page">
    <!-- Toolbar (requires VueFlow context → inside a VueFlowProvider or after VueFlow mounts) -->
    <CanvasToolbar
      @save="handleSave"
      @execute="handleExecute"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @fit-view="handleFitView"
    />

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
      <WorkflowCanvas ref="canvasRef" class="flex-1" />

      <!-- Right: config panel (absolute overlay) -->
      <NodeConfigPanel />

      <!-- Right: execution log panel -->
      <div
        v-if="showExecPanel"
        class="w-80 shrink-0"
        data-testid="execution-panel-wrapper"
      >
        <ExecutionLogPanel
          :execution-id="trackedExecutionId"
          @close="showExecPanel = false"
        />
      </div>
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
