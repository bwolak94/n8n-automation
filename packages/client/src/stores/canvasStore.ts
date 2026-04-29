import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CanvasNode, CanvasEdge, WorkflowSummary } from "../shared/types/index.js";
import { updateWorkflow } from "../shared/api/workflows.js";
import { useUndoRedo } from "../features/canvas/composables/useUndoRedo.js";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface CanvasSnapshot {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const useCanvasStore = defineStore("canvas", () => {
  const nodes = ref<CanvasNode[]>([]);
  const edges = ref<CanvasEdge[]>([]);
  const selectedNodeId = ref<string | null>(null);
  const workflowId = ref<string | null>(null);
  const isDirty = ref(false);

  const history = useUndoRedo<CanvasSnapshot>(50);

  function _snapshot(): CanvasSnapshot {
    return { nodes: [...nodes.value], edges: [...edges.value] };
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  const selectedNode = computed(() =>
    nodes.value.find((n) => n.id === selectedNodeId.value) ?? null
  );

  const nodeCount = computed(() => nodes.value.length);
  const edgeCount = computed(() => edges.value.length);

  // ── Node actions ───────────────────────────────────────────────────────────

  function addNode(
    partial: Omit<CanvasNode, "id"> & { id?: string }
  ): CanvasNode {
    history.push(_snapshot());
    const node: CanvasNode = {
      id: partial.id ?? generateId(),
      type: partial.type,
      category: partial.category,
      label: partial.label,
      position: partial.position ?? { x: 0, y: 0 },
      config: partial.config ?? {},
    };
    nodes.value.push(node);
    isDirty.value = true;
    return node;
  }

  function removeNode(id: string): void {
    history.push(_snapshot());
    nodes.value = nodes.value.filter((n) => n.id !== id);
    // Remove all edges connected to this node
    edges.value = edges.value.filter(
      (e) => e.source !== id && e.target !== id
    );
    if (selectedNodeId.value === id) {
      selectedNodeId.value = null;
    }
    isDirty.value = true;
  }

  function updateNodePosition(
    id: string,
    position: CanvasNode["position"]
  ): void {
    const node = nodes.value.find((n) => n.id === id);
    if (node) {
      node.position = position;
      isDirty.value = true;
    }
  }

  function updateNodeConfig(
    id: string,
    config: Record<string, unknown>
  ): void {
    const node = nodes.value.find((n) => n.id === id);
    if (node) {
      node.config = { ...node.config, ...config };
      isDirty.value = true;
    }
  }

  function selectNode(id: string | null): void {
    selectedNodeId.value = id;
  }

  // ── Edge actions ───────────────────────────────────────────────────────────

  function addEdge(
    partial: Omit<CanvasEdge, "id"> & { id?: string }
  ): CanvasEdge {
    history.push(_snapshot());
    const edge: CanvasEdge = {
      id: partial.id ?? generateId(),
      source: partial.source,
      target: partial.target,
      sourceHandle: partial.sourceHandle,
      targetHandle: partial.targetHandle,
    };
    edges.value.push(edge);
    isDirty.value = true;
    return edge;
  }

  function removeEdge(id: string): void {
    edges.value = edges.value.filter((e) => e.id !== id);
    isDirty.value = true;
  }

  // ── Workflow loading ───────────────────────────────────────────────────────

  function loadWorkflow(workflow: WorkflowSummary): void {
    workflowId.value = workflow.id;
    nodes.value = workflow.nodes as CanvasNode[];
    edges.value = workflow.edges as CanvasEdge[];
    selectedNodeId.value = null;
    isDirty.value = false;
  }

  function markSaved(): void {
    isDirty.value = false;
  }

  async function saveWorkflow(): Promise<void> {
    if (!workflowId.value) return;
    await updateWorkflow(workflowId.value, {
      nodes: nodes.value,
      edges: edges.value,
    });
    markSaved();
  }

  function undo(): void {
    const prev = history.undo(_snapshot());
    if (prev) {
      nodes.value = [...prev.nodes];
      edges.value = [...prev.edges];
      isDirty.value = true;
    }
  }

  function redo(): void {
    const next = history.redo(_snapshot());
    if (next) {
      nodes.value = [...next.nodes];
      edges.value = [...next.edges];
      isDirty.value = true;
    }
  }

  function reset(): void {
    nodes.value = [];
    edges.value = [];
    selectedNodeId.value = null;
    workflowId.value = null;
    isDirty.value = false;
    history.clear();
  }

  return {
    nodes,
    edges,
    selectedNodeId,
    workflowId,
    isDirty,
    selectedNode,
    nodeCount,
    edgeCount,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    addNode,
    removeNode,
    updateNodePosition,
    updateNodeConfig,
    selectNode,
    addEdge,
    removeEdge,
    loadWorkflow,
    markSaved,
    saveWorkflow,
    undo,
    redo,
    reset,
  };
});
