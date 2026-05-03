// ─── Canvas Operation Types ───────────────────────────────────────────────────

export interface MoveNodeOp {
  readonly type: "move_node";
  readonly nodeId: string;
  readonly position: { readonly x: number; readonly y: number };
}

export interface UpdateConfigOp {
  readonly type: "update_config";
  readonly nodeId: string;
  readonly config: Record<string, unknown>;
}

export interface DeleteNodeOp {
  readonly type: "delete_node";
  readonly nodeId: string;
}

export interface AddEdgeOp {
  readonly type: "add_edge";
  readonly edgeId: string;
  readonly source: string;
  readonly target: string;
}

export interface DeleteEdgeOp {
  readonly type: "delete_edge";
  readonly edgeId: string;
}

export interface AddNodeOp {
  readonly type: "add_node";
  readonly node: {
    readonly id: string;
    readonly type: string;
    readonly position: { readonly x: number; readonly y: number };
    readonly config: Record<string, unknown>;
  };
}

export type CanvasOp =
  | MoveNodeOp
  | UpdateConfigOp
  | DeleteNodeOp
  | AddEdgeOp
  | DeleteEdgeOp
  | AddNodeOp;

// ─── OT Transform Result ──────────────────────────────────────────────────────

export type TransformResult =
  | { readonly outcome: "apply" }
  | { readonly outcome: "reject"; readonly reason: string };

// ─── OT Transform — pure function, no infrastructure dependencies ─────────────

/**
 * Given an incoming op and a list of concurrent ops already applied to the
 * workflow, returns whether the incoming op should be applied or rejected.
 *
 * Implements the five conflict rules from the PRD:
 *  1. Two users move different nodes       → both applied
 *  2. Two users move the same node         → first wins; second rejected ("conflict:move")
 *  3. Config edit + move on same node      → both applied (different properties)
 *  4. Delete node + config edit same node  → delete wins; edit rejected ("node:deleted")
 *  5. Add edge + delete source/target node → edge rejected ("invalid:source")
 */
export function transformOp(
  incoming: CanvasOp,
  concurrent: readonly CanvasOp[]
): TransformResult {
  for (const applied of concurrent) {
    const result = transformPair(incoming, applied);
    if (result.outcome === "reject") return result;
  }
  return { outcome: "apply" };
}

function transformPair(incoming: CanvasOp, applied: CanvasOp): TransformResult {
  // Rule 5 — add_edge when source or target was deleted → reject
  if (incoming.type === "add_edge" && applied.type === "delete_node") {
    if (
      incoming.source === applied.nodeId ||
      incoming.target === applied.nodeId
    ) {
      return { outcome: "reject", reason: "invalid:source" };
    }
  }

  // Rule 4 — update_config when node was deleted → reject
  if (incoming.type === "update_config" && applied.type === "delete_node") {
    if (incoming.nodeId === applied.nodeId) {
      return { outcome: "reject", reason: "node:deleted" };
    }
  }

  // Rule 2 — move_node conflict on same node → reject second
  if (incoming.type === "move_node" && applied.type === "move_node") {
    if (incoming.nodeId === applied.nodeId) {
      return { outcome: "reject", reason: "conflict:move" };
    }
  }

  // Rules 1 & 3 — no conflict
  return { outcome: "apply" };
}
