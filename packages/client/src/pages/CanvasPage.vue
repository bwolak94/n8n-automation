<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useCanvasStore } from "../stores/canvasStore.js";
import { useWorkflowQuery } from "../shared/queries/useWorkflows.js";
import { useExecuteWorkflow } from "../shared/queries/useWorkflows.js";
import { useNodeRegistryStore } from "../stores/nodeRegistryStore.js";
import { useNodeDefinitionsQuery } from "../shared/queries/useNodes.js";
import WorkflowCanvas from "../features/canvas/components/WorkflowCanvas.vue";
import NodePalette from "../features/canvas/components/NodePalette.vue";
import NodeConfigPanel from "../features/canvas/components/NodeConfigPanel.vue";
import CanvasToolbar from "../features/canvas/components/CanvasToolbar.vue";

const route = useRoute();
const canvasStore = useCanvasStore();
const canvasRef = ref<InstanceType<typeof WorkflowCanvas> | null>(null);
const registryStore = useNodeRegistryStore();

const workflowId = route.params["id"] as string;
const { data: workflow, isPending } = useWorkflowQuery(workflowId);
const { data: nodeDefs } = useNodeDefinitionsQuery();
const { mutate: executeWorkflow } = useExecuteWorkflow();

// Populate canvas when workflow loads
watch(workflow, (wf) => {
  if (wf) canvasStore.loadWorkflow(wf);
}, { immediate: true });

// Populate node registry when definitions load
watch(nodeDefs, (defs) => {
  if (defs && !registryStore.isLoaded) registryStore.setDefinitions(defs);
}, { immediate: true });

async function handleSave(): Promise<void> {
  await canvasStore.saveWorkflow();
}

function handleExecute(): void {
  if (canvasStore.workflowId) {
    executeWorkflow({ id: canvasStore.workflowId });
  }
}

function handleZoomIn(): void { canvasRef.value?.zoomIn(); }
function handleZoomOut(): void { canvasRef.value?.zoomOut(); }
function handleFitView(): void { canvasRef.value?.fitView(); }
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden" data-testid="canvas-page">
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
    </div>
  </div>
</template>
