<script setup lang="ts">
import { computed, markRaw, watch, ref, onMounted, onUnmounted } from "vue";
import { getDragNode, clearDragNode } from "../composables/useDragNode.js";
import {
  VueFlow,
  useVueFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node as VFNode,
  type Edge as VFEdge,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { useCanvasStore } from "../../../stores/canvasStore.js";
import { useExecutionStore } from "../../../stores/executionStore.js";
import HttpRequestNodeCard from "./nodes/HttpRequestNodeCard.vue";
import AiTransformNodeCard from "./nodes/AiTransformNodeCard.vue";
import ConditionNodeCard from "./nodes/ConditionNodeCard.vue";
import WebhookNodeCard from "./nodes/WebhookNodeCard.vue";
import JavaScriptNodeCard from "./nodes/JavaScriptNodeCard.vue";

const canvasStore = useCanvasStore();
const executionStore = useExecutionStore();

// ── Custom node type registry ───────────────────────────────────────────────

const nodeTypes = {
  http_request: markRaw(HttpRequestNodeCard),
  ai_transform: markRaw(AiTransformNodeCard),
  condition: markRaw(ConditionNodeCard),
  webhook: markRaw(WebhookNodeCard),
  javascript: markRaw(JavaScriptNodeCard),
};

// ── Category → edge colour ──────────────────────────────────────────────────

const categoryEdgeClass: Record<string, string> = {
  triggers: "edge-triggers",
  actions: "edge-actions",
  logic: "edge-logic",
  data: "edge-data",
  ai: "edge-ai",
  communication: "edge-communication",
  integrations: "edge-integrations",
};

function sourceCategory(sourceId: string): string {
  return canvasStore.nodes.find((n) => n.id === sourceId)?.category ?? "";
}

// ── Vue Flow nodes / edges (derived from store) ─────────────────────────────

const isWorkflowRunning = computed(() => {
  const exec = executionStore.currentExecution;
  return exec?.status === "running";
});

const vfNodes = computed<VFNode[]>(() =>
  canvasStore.nodes.map((n) => ({
    id: n.id,
    type: n.type in nodeTypes ? n.type : "default",
    position: n.position,
    data: {
      label: n.label,
      category: n.category,
      config: n.config,
      status: "idle" as const,
    },
    selected: n.id === canvasStore.selectedNodeId,
  }))
);

const vfEdges = computed<VFEdge[]>(() =>
  canvasStore.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    animated: isWorkflowRunning.value,
    class: categoryEdgeClass[sourceCategory(e.source)] ?? "",
  }))
);

// ── Change handlers (single entry-point for all mutations) ──────────────────

function onNodesChange(changes: NodeChange[]): void {
  for (const change of changes) {
    if (change.type === "position" && change.position) {
      canvasStore.updateNodePosition(change.id, change.position);
    } else if (change.type === "remove") {
      canvasStore.removeNode(change.id);
    } else if (change.type === "select") {
      canvasStore.selectNode(change.selected ? change.id : null);
    }
  }
}

function onEdgesChange(changes: EdgeChange[]): void {
  for (const change of changes) {
    if (change.type === "remove") {
      canvasStore.removeEdge(change.id);
    }
  }
}

function onConnect(connection: Connection): void {
  canvasStore.addEdge({
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    targetHandle: connection.targetHandle ?? undefined,
  });
}

// ── Auto-save (debounced 1 s) ───────────────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => canvasStore.isDirty,
  (dirty) => {
    if (!dirty) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (canvasStore.isDirty && canvasStore.workflowId) {
        canvasStore.saveWorkflow().catch(() => undefined);
      }
    }, 1000);
  }
);

// ── Drag-and-drop from palette ──────────────────────────────────────────────

const { screenToFlowCoordinate, zoomIn, zoomOut, fitView } = useVueFlow();

defineExpose({ zoomIn, zoomOut, fitView });

const canvasWrapperRef = ref<HTMLDivElement | null>(null);

function isOverCanvas(event: Event): boolean {
  const el = canvasWrapperRef.value;
  return !!el && el.contains(event.target as Node);
}

// Window-level capture listeners fire before any VueFlow internal handler,
// bypassing stopPropagation() calls inside the VueFlow pane.
function windowDragOver(event: DragEvent): void {
  if (!isOverCanvas(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
}

function windowDrop(event: DragEvent): void {
  if (!isOverCanvas(event)) return;
  event.preventDefault();

  const dragData = getDragNode();
  clearDragNode();
  if (!dragData) return;

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });

  canvasStore.addNode({
    type: dragData.type,
    label: dragData.label || dragData.type,
    category: dragData.category || "actions",
    position,
    config: {},
  });
}

onMounted(() => {
  window.addEventListener("dragover", windowDragOver, true);
  window.addEventListener("drop", windowDrop, true);
});

onUnmounted(() => {
  window.removeEventListener("dragover", windowDragOver, true);
  window.removeEventListener("drop", windowDrop, true);
});

// ── Node click → open config panel ─────────────────────────────────────────

function onNodeClick({ node }: { node: VFNode }): void {
  canvasStore.selectNode(node.id as string);
}
</script>

<template>
  <div
    ref="canvasWrapperRef"
    class="relative h-full w-full"
    data-testid="workflow-canvas"
  >
    <VueFlow
      :nodes="vfNodes"
      :edges="vfEdges"
      :node-types="nodeTypes"
      class="h-full w-full"
      :default-edge-options="{ type: 'smoothstep' }"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @node-click="onNodeClick"
    >
      <Background pattern-color="#e5e7eb" :gap="20" />

      <!-- Empty state -->
      <div
        v-if="canvasStore.nodeCount === 0"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <p class="text-sm text-gray-400" data-testid="empty-canvas-hint">
          Drag a node from the palette to get started
        </p>
      </div>
    </VueFlow>
  </div>
</template>
