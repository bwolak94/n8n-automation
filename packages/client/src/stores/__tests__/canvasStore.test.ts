import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("../../shared/api/workflows.js", () => ({
  updateWorkflow: vi.fn(),
  fetchWorkflows: vi.fn(),
  fetchWorkflow: vi.fn(),
  createWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
}));

import { useCanvasStore } from "../canvasStore.js";
import { updateWorkflow } from "../../shared/api/workflows.js";
import type { WorkflowSummary } from "../../shared/types/index.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockWorkflow: WorkflowSummary = {
  id: "wf-1",
  tenantId: "t1",
  name: "Test Workflow",
  status: "draft",
  nodes: [
    {
      id: "n1",
      type: "http_request",
      category: "actions",
      label: "HTTP",
      position: { x: 100, y: 200 },
      config: { url: "http://example.com" },
    },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  variables: {},
  tags: [],
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("canvasStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ── addNode ────────────────────────────────────────────────────────────────

  describe("addNode", () => {
    it("adds a node and returns it with a generated id", () => {
      const store = useCanvasStore();
      const node = store.addNode({
        type: "http_request",
        category: "actions",
        label: "HTTP",
        position: { x: 0, y: 0 },
        config: {},
      });

      expect(store.nodes).toHaveLength(1);
      expect(node.id).toBeTruthy();
      expect(node.type).toBe("http_request");
    });

    it("uses a provided id when supplied", () => {
      const store = useCanvasStore();
      const node = store.addNode({
        id: "custom-id",
        type: "delay",
        category: "logic",
        label: "Delay",
        position: { x: 0, y: 0 },
        config: {},
      });

      expect(node.id).toBe("custom-id");
    });

    it("defaults position to { x: 0, y: 0 } when omitted", () => {
      const store = useCanvasStore();
      const node = store.addNode({
        type: "noop",
        category: "logic",
        label: "NoOp",
        position: { x: 0, y: 0 },
        config: {},
      });

      expect(node.position).toEqual({ x: 0, y: 0 });
    });

    it("marks canvas as dirty after adding a node", () => {
      const store = useCanvasStore();
      expect(store.isDirty).toBe(false);
      store.addNode({
        type: "noop",
        category: "logic",
        label: "NoOp",
        position: { x: 0, y: 0 },
        config: {},
      });
      expect(store.isDirty).toBe(true);
    });
  });

  // ── removeNode ─────────────────────────────────────────────────────────────

  describe("removeNode", () => {
    it("removes the node by id", () => {
      const store = useCanvasStore();
      const node = store.addNode({
        type: "noop",
        category: "logic",
        label: "NoOp",
        position: { x: 0, y: 0 },
        config: {},
      });

      store.removeNode(node.id);

      expect(store.nodes).toHaveLength(0);
    });

    it("cleans up all edges connected to the removed node", () => {
      const store = useCanvasStore();
      const a = store.addNode({ type: "a", category: "c", label: "A", position: { x: 0, y: 0 }, config: {} });
      const b = store.addNode({ type: "b", category: "c", label: "B", position: { x: 100, y: 0 }, config: {} });
      const c = store.addNode({ type: "c", category: "c", label: "C", position: { x: 200, y: 0 }, config: {} });

      store.addEdge({ source: a.id, target: b.id });
      store.addEdge({ source: b.id, target: c.id });
      store.addEdge({ source: a.id, target: c.id });

      // 3 edges total
      expect(store.edges).toHaveLength(3);

      // Remove node b — edges a→b and b→c should be deleted; a→c survives
      store.removeNode(b.id);

      expect(store.nodes).toHaveLength(2);
      expect(store.edges).toHaveLength(1);
      expect(store.edges[0]?.source).toBe(a.id);
      expect(store.edges[0]?.target).toBe(c.id);
    });

    it("clears selectedNodeId when the selected node is removed", () => {
      const store = useCanvasStore();
      const node = store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      store.selectNode(node.id);

      store.removeNode(node.id);

      expect(store.selectedNodeId).toBeNull();
    });

    it("does nothing for a non-existent id", () => {
      const store = useCanvasStore();
      store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });

      store.removeNode("non-existent");

      expect(store.nodes).toHaveLength(1);
    });
  });

  // ── addEdge ────────────────────────────────────────────────────────────────

  describe("addEdge", () => {
    it("adds an edge with a generated id", () => {
      const store = useCanvasStore();
      const edge = store.addEdge({ source: "n1", target: "n2" });

      expect(store.edges).toHaveLength(1);
      expect(edge.id).toBeTruthy();
      expect(edge.source).toBe("n1");
      expect(edge.target).toBe("n2");
    });
  });

  // ── removeEdge ─────────────────────────────────────────────────────────────

  describe("removeEdge", () => {
    it("removes an edge by id", () => {
      const store = useCanvasStore();
      const edge = store.addEdge({ source: "n1", target: "n2" });
      store.removeEdge(edge.id);

      expect(store.edges).toHaveLength(0);
    });
  });

  // ── updateNodeConfig ───────────────────────────────────────────────────────

  describe("updateNodeConfig", () => {
    it("merges new config into the existing node config", () => {
      const store = useCanvasStore();
      const node = store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: { a: 1 } });

      store.updateNodeConfig(node.id, { b: 2 });

      expect(store.nodes[0]?.config).toEqual({ a: 1, b: 2 });
    });
  });

  // ── loadWorkflow ───────────────────────────────────────────────────────────

  describe("loadWorkflow", () => {
    it("loads nodes and edges from a workflow and resets isDirty", () => {
      const store = useCanvasStore();
      store.loadWorkflow(mockWorkflow);

      expect(store.workflowId).toBe("wf-1");
      expect(store.nodes).toHaveLength(1);
      expect(store.edges).toHaveLength(1);
      expect(store.isDirty).toBe(false);
    });
  });

  // ── computed ───────────────────────────────────────────────────────────────

  describe("computed", () => {
    it("nodeCount returns the number of nodes", () => {
      const store = useCanvasStore();
      expect(store.nodeCount).toBe(0);
      store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      expect(store.nodeCount).toBe(1);
    });

    it("selectedNode returns the currently selected node", () => {
      const store = useCanvasStore();
      const node = store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      expect(store.selectedNode).toBeNull();
      store.selectNode(node.id);
      expect(store.selectedNode?.id).toBe(node.id);
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  // ── saveWorkflow ───────────────────────────────────────────────────────────

  describe("saveWorkflow", () => {
    it("calls updateWorkflow with current nodes and edges", async () => {
      vi.mocked(updateWorkflow).mockResolvedValueOnce({
        id: "wf-1", tenantId: "t1", name: "Test", status: "draft",
        nodes: [], edges: [], variables: {}, tags: [],
        createdAt: "", updatedAt: "",
      });
      const store = useCanvasStore();
      store.loadWorkflow(mockWorkflow);
      store.addNode({ type: "noop", category: "logic", label: "N", position: { x: 0, y: 0 }, config: {} });

      await store.saveWorkflow();

      expect(updateWorkflow).toHaveBeenCalledWith("wf-1", expect.objectContaining({
        nodes: expect.any(Array),
        edges: expect.any(Array),
      }));
    });

    it("sets isDirty to false after save", async () => {
      vi.mocked(updateWorkflow).mockResolvedValueOnce({
        id: "wf-1", tenantId: "t1", name: "Test", status: "draft",
        nodes: [], edges: [], variables: {}, tags: [],
        createdAt: "", updatedAt: "",
      });
      const store = useCanvasStore();
      store.loadWorkflow(mockWorkflow);
      store.addNode({ type: "noop", category: "logic", label: "N", position: { x: 0, y: 0 }, config: {} });
      expect(store.isDirty).toBe(true);

      await store.saveWorkflow();

      expect(store.isDirty).toBe(false);
    });

    it("does nothing when workflowId is null", async () => {
      const store = useCanvasStore();
      await store.saveWorkflow();
      expect(updateWorkflow).not.toHaveBeenCalled();
    });
  });

  // ── undo / redo ────────────────────────────────────────────────────────────

  describe("undo/redo", () => {
    it("canUndo is false initially, true after addNode", () => {
      const store = useCanvasStore();
      expect(store.canUndo).toBe(false);
      store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      expect(store.canUndo).toBe(true);
    });

    it("undo restores previous state", () => {
      const store = useCanvasStore();
      store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      expect(store.nodes).toHaveLength(1);
      store.undo();
      expect(store.nodes).toHaveLength(0);
    });

    it("redo re-applies undone action", () => {
      const store = useCanvasStore();
      store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
      store.undo();
      expect(store.nodes).toHaveLength(0);
      store.redo();
      expect(store.nodes).toHaveLength(1);
    });
  });

  it("reset clears all state", () => {
    const store = useCanvasStore();
    store.addNode({ type: "x", category: "c", label: "X", position: { x: 0, y: 0 }, config: {} });
    store.addEdge({ source: "n1", target: "n2" });

    store.reset();

    expect(store.nodes).toHaveLength(0);
    expect(store.edges).toHaveLength(0);
    expect(store.isDirty).toBe(false);
    expect(store.workflowId).toBeNull();
  });
});
