import { describe, it, expect } from "@jest/globals";
import { transformOp } from "../../modules/collaboration/CanvasOp.js";
import type { CanvasOp } from "../../modules/collaboration/CanvasOp.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const moveA: CanvasOp = { type: "move_node", nodeId: "a", position: { x: 1, y: 2 } };
const moveB: CanvasOp = { type: "move_node", nodeId: "b", position: { x: 3, y: 4 } };
const moveA2: CanvasOp = { type: "move_node", nodeId: "a", position: { x: 5, y: 6 } };
const configA: CanvasOp = { type: "update_config", nodeId: "a", config: { url: "x" } };
const deleteA: CanvasOp = { type: "delete_node", nodeId: "a" };
const addEdgeAB: CanvasOp = { type: "add_edge", edgeId: "e1", source: "a", target: "b" };
const addEdgeBC: CanvasOp = { type: "add_edge", edgeId: "e2", source: "b", target: "c" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("transformOp — OT conflict rules", () => {
  // Rule 1: Two users move different nodes → both applied
  it("allows two moves on different nodes", () => {
    expect(transformOp(moveB, [moveA])).toEqual({ outcome: "apply" });
  });

  // Rule 2: Two users move the same node → first wins; second rejected
  it("rejects second move on the same node", () => {
    expect(transformOp(moveA2, [moveA])).toEqual({
      outcome: "reject",
      reason: "conflict:move",
    });
  });

  // Rule 3: Config edit + move on same node → both applied (different properties)
  it("allows config edit when the same node was moved", () => {
    expect(transformOp(configA, [moveA])).toEqual({ outcome: "apply" });
  });

  // Rule 4: Delete node + config edit on same node → delete wins; edit rejected
  it("rejects config edit when the node was deleted", () => {
    expect(transformOp(configA, [deleteA])).toEqual({
      outcome: "reject",
      reason: "node:deleted",
    });
  });

  // Rule 5: Add edge + delete source/target node → edge rejected
  it("rejects add_edge when the source node was deleted", () => {
    expect(transformOp(addEdgeAB, [deleteA])).toEqual({
      outcome: "reject",
      reason: "invalid:source",
    });
  });

  it("rejects add_edge when the target node was deleted", () => {
    const deleteB: CanvasOp = { type: "delete_node", nodeId: "b" };
    expect(transformOp(addEdgeAB, [deleteB])).toEqual({
      outcome: "reject",
      reason: "invalid:source",
    });
  });

  // No conflict cases
  it("allows add_edge when neither endpoint was deleted", () => {
    expect(transformOp(addEdgeBC, [deleteA])).toEqual({ outcome: "apply" });
  });

  it("allows config edit on a different node than the deleted one", () => {
    const configB: CanvasOp = {
      type: "update_config",
      nodeId: "b",
      config: {},
    };
    expect(transformOp(configB, [deleteA])).toEqual({ outcome: "apply" });
  });

  it("returns apply when concurrent list is empty", () => {
    expect(transformOp(moveA, [])).toEqual({ outcome: "apply" });
  });

  it("rejects at the first conflicting op in a concurrent list", () => {
    // moveA already applied, then deleteA applied — incoming moveA2 (same node as moveA) rejected
    expect(transformOp(moveA2, [moveA, deleteA])).toEqual({
      outcome: "reject",
      reason: "conflict:move",
    });
  });

  it("checks add_node op does not conflict", () => {
    const addNode: CanvasOp = {
      type: "add_node",
      node: { id: "n1", type: "http_request", position: { x: 0, y: 0 }, config: {} },
    };
    expect(transformOp(addNode, [moveA, deleteA])).toEqual({ outcome: "apply" });
  });

  it("checks delete_edge op does not conflict", () => {
    const deleteEdge: CanvasOp = { type: "delete_edge", edgeId: "e1" };
    expect(transformOp(deleteEdge, [deleteA])).toEqual({ outcome: "apply" });
  });
});
