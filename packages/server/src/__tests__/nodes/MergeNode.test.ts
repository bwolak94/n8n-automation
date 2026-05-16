import { describe, it, expect, beforeEach } from "@jest/globals";
import { MergeNode, MERGE_PENDING_KEY } from "../../nodes/implementations/MergeNode.js";
import { InMemoryBranchSyncManager } from "../../engine/BranchSyncManager.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

function makeCtx(nodeId = "merge-1"): ExecutionContext {
  return {
    tenantId: "t-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    nodeId,
    variables: {},
  };
}

describe("MergeNode", () => {
  let sync: InMemoryBranchSyncManager;
  let node: MergeNode;

  beforeEach(() => {
    sync = new InMemoryBranchSyncManager();
    node = new MergeNode(sync);
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("merge");
  });

  // ── waitAll — single-branch calls ──────────────────────────────────────────

  describe("waitAll mode — single-branch calls", () => {
    it("returns MERGE_PENDING on first call when inputCount=2", async () => {
      const out = await node.execute(
        { name: "Alice" },
        { mode: "waitAll", inputCount: 2, branchIndex: 0 },
        makeCtx()
      );
      expect(out.metadata?.[MERGE_PENDING_KEY]).toBe(true);
    });

    it("returns merged output on last call (all branches arrived)", async () => {
      const ctx = makeCtx();
      await node.execute(
        { name: "Alice" },
        { mode: "waitAll", inputCount: 2, branchIndex: 0 },
        ctx
      );
      const out = await node.execute(
        { score: 99 },
        { mode: "waitAll", inputCount: 2, branchIndex: 1 },
        ctx
      );
      const data = out.data as { branches: unknown[]; branchCount: number };
      expect(data.branchCount).toBe(2);
      expect(data.branches).toEqual([{ name: "Alice" }, { score: 99 }]);
    });

    it("returns branches in branchIndex order, not arrival order", async () => {
      const ctx = makeCtx();
      // Branch 1 arrives first, then branch 0
      await node.execute(
        { second: true },
        { mode: "waitAll", inputCount: 2, branchIndex: 1 },
        ctx
      );
      const out = await node.execute(
        { first: true },
        { mode: "waitAll", inputCount: 2, branchIndex: 0 },
        ctx
      );
      const data = out.data as { branches: unknown[] };
      expect(data.branches[0]).toEqual({ first: true });
      expect(data.branches[1]).toEqual({ second: true });
    });
  });

  // ── waitAll — array input (WorkflowRunner multi-input) ────────────────────

  describe("waitAll mode — array input", () => {
    it("merges all branches when array is passed", async () => {
      const out = await node.execute(
        [{ a: 1 }, { b: 2 }],
        { mode: "waitAll" },
        makeCtx()
      );
      const data = out.data as { branches: unknown[]; branchCount: number };
      expect(data.branchCount).toBe(2);
      expect(data.branches).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it("unwraps NodeOutput wrappers in array input", async () => {
      const out = await node.execute(
        [{ data: { x: 1 } }, { data: { y: 2 } }],
        { mode: "waitAll" },
        makeCtx()
      );
      const data = out.data as { branches: unknown[] };
      // NodeOutput { data: { x: 1 } } → unwrapped to { x: 1 }
      expect(data.branches[0]).toEqual({ x: 1 });
      expect(data.branches[1]).toEqual({ y: 2 });
    });

    it("cleans up Redis state after merge", async () => {
      const ctx = makeCtx();
      await node.execute([{ a: 1 }, { b: 2 }], { mode: "waitAll" }, ctx);
      // After merge, bucket should be empty
      const count = await sync.getCount(ctx.executionId, ctx.nodeId!);
      expect(count).toBe(0);
    });
  });

  // ── mergeByKey ────────────────────────────────────────────────────────────

  describe("mergeByKey mode", () => {
    it("inner join: merges matching objects and excludes non-matching", async () => {
      const branches = [
        [{ userId: 1, name: "Alice" }, { userId: 2, name: "Bob" }],
        [{ userId: 1, score: 99 }],
      ];
      const out = await node.execute(
        branches,
        { mode: "mergeByKey", joinKey: "userId", joinType: "inner" },
        makeCtx()
      );
      expect(out.data).toEqual([{ userId: 1, name: "Alice", score: 99 }]);
    });

    it("left join: preserves all left-branch items, unmatched right items skipped", async () => {
      const branches = [
        [{ userId: 1, name: "Alice" }, { userId: 2, name: "Bob" }],
        [{ userId: 1, score: 99 }],
      ];
      const out = await node.execute(
        branches,
        { mode: "mergeByKey", joinKey: "userId", joinType: "left" },
        makeCtx()
      );
      expect(out.data).toEqual([
        { userId: 1, name: "Alice", score: 99 },
        { userId: 2, name: "Bob" },
      ]);
    });

    it("merges plain objects (non-array branches) by key", async () => {
      const out = await node.execute(
        [{ userId: 1, name: "Alice" }, { userId: 1, score: 99 }],
        { mode: "mergeByKey", joinKey: "userId", joinType: "inner" },
        makeCtx()
      );
      expect(out.data).toEqual([{ userId: 1, name: "Alice", score: 99 }]);
    });
  });

  // ── append ────────────────────────────────────────────────────────────────

  describe("append mode", () => {
    it("concatenates arrays from all branches", async () => {
      const out = await node.execute(
        [[1, 2, 3], [4, 5]],
        { mode: "append" },
        makeCtx()
      );
      expect(out.data).toEqual([1, 2, 3, 4, 5]);
    });

    it("wraps non-array branch data as single-element arrays", async () => {
      const out = await node.execute(
        ["alpha", "beta"],
        { mode: "append" },
        makeCtx()
      );
      expect(out.data).toEqual(["alpha", "beta"]);
    });
  });

  // ── firstWins ─────────────────────────────────────────────────────────────

  describe("firstWins mode", () => {
    it("first arrival returns its data immediately", async () => {
      const out = await node.execute(
        { winner: true },
        { mode: "firstWins", inputCount: 3, branchIndex: 0 },
        makeCtx()
      );
      expect(out.data).toEqual({ winner: true });
    });

    it("second arrival is discarded (returns pending sentinel)", async () => {
      const ctx = makeCtx();
      await node.execute(
        { winner: true },
        { mode: "firstWins", inputCount: 3, branchIndex: 0 },
        ctx
      );
      const out = await node.execute(
        { late: true },
        { mode: "firstWins", inputCount: 3, branchIndex: 1 },
        ctx
      );
      expect(out.metadata?.[MERGE_PENDING_KEY]).toBe(true);
    });

    it("array input: first element wins", async () => {
      const out = await node.execute(
        [{ fast: true }, { slow: true }],
        { mode: "firstWins" },
        makeCtx()
      );
      expect(out.data).toEqual({ fast: true });
    });
  });

  // ── inputCount validation ─────────────────────────────────────────────────

  it("defaults inputCount to 2 when not provided", async () => {
    const ctx = makeCtx();
    await node.execute({ a: 1 }, { mode: "waitAll", branchIndex: 0 }, ctx);
    const out = await node.execute({ b: 2 }, { mode: "waitAll", branchIndex: 1 }, ctx);
    // Should complete on second call (inputCount defaulted to 2)
    expect((out.data as { branchCount: number }).branchCount).toBe(2);
  });

  it("handles 3-branch waitAll correctly", async () => {
    const ctx = makeCtx();
    const config = { mode: "waitAll" as const, inputCount: 3 };
    const p0 = await node.execute("A", { ...config, branchIndex: 0 }, ctx);
    const p1 = await node.execute("B", { ...config, branchIndex: 1 }, ctx);
    const p2 = await node.execute("C", { ...config, branchIndex: 2 }, ctx);

    expect(p0.metadata?.[MERGE_PENDING_KEY]).toBe(true);
    expect(p1.metadata?.[MERGE_PENDING_KEY]).toBe(true);
    const data = p2.data as { branches: unknown[] };
    expect(data.branches).toEqual(["A", "B", "C"]);
  });
});
