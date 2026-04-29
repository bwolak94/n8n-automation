import { describe, expect, it } from "@jest/globals";
import { MergeNode } from "../../nodes/implementations/MergeNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new MergeNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MergeNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("merge");
  });

  // ── concat ───────────────────────────────────────────────────────────────

  describe("concat strategy", () => {
    it("flattens array branches into a single array", async () => {
      const out = await node.execute(
        [[1, 2], [3, 4], [5]],
        { strategy: "concat" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual([1, 2, 3, 4, 5]);
    });

    it("wraps non-array scalars as single-element arrays", async () => {
      const out = await node.execute(
        ["hello", "world"],
        { strategy: "concat" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual(["hello", "world"]);
    });
  });

  // ── zip ──────────────────────────────────────────────────────────────────

  describe("zip strategy", () => {
    it("zips two equal-length arrays element by element", async () => {
      const out = await node.execute(
        [[1, 2, 3], ["a", "b", "c"]],
        { strategy: "zip" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual([
        [1, "a"],
        [2, "b"],
        [3, "c"],
      ]);
    });

    it("handles mismatched lengths by using undefined for short arrays", async () => {
      const out = await node.execute(
        [[1, 2], ["a"]],
        { strategy: "zip" },
        ctx
      );
      const merged = (out.data as { merged: unknown[] }).merged;
      expect(merged).toHaveLength(2);
    });

    it("returns empty array when no array branches present", async () => {
      const out = await node.execute(
        ["not-array"],
        { strategy: "zip" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual([]);
    });
  });

  // ── first / last ─────────────────────────────────────────────────────────

  describe("first strategy", () => {
    it("returns the first branch output", async () => {
      const out = await node.execute(
        ["first-value", "second-value"],
        { strategy: "first" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toBe("first-value");
    });
  });

  describe("last strategy", () => {
    it("returns the last branch output", async () => {
      const out = await node.execute(
        ["first-value", "second-value", "third-value"],
        { strategy: "last" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toBe("third-value");
    });
  });

  // ── merge_objects ─────────────────────────────────────────────────────────

  describe("merge_objects strategy", () => {
    it("merges object branches using Object.assign semantics", async () => {
      const out = await node.execute(
        [{ a: 1, b: 2 }, { b: 99, c: 3 }],
        { strategy: "merge_objects" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual({
        a: 1,
        b: 99,
        c: 3,
      });
    });

    it("ignores non-object branches", async () => {
      const out = await node.execute(
        [{ a: 1 }, "ignored-string", null, { b: 2 }],
        { strategy: "merge_objects" },
        ctx
      );
      expect((out.data as { merged: unknown }).merged).toEqual({ a: 1, b: 2 });
    });
  });

  // ── waitFor ──────────────────────────────────────────────────────────────

  describe("waitFor validation", () => {
    it("passes when branch count meets waitFor", async () => {
      const out = await node.execute(
        ["a", "b", "c"],
        { strategy: "first", waitFor: 3 },
        ctx
      );
      expect(out.data).toBeDefined();
    });

    it("passes when branch count exceeds waitFor", async () => {
      const out = await node.execute(
        ["a", "b", "c", "d"],
        { strategy: "last", waitFor: 2 },
        ctx
      );
      expect(out.data).toBeDefined();
    });

    it("throws MERGE_INSUFFICIENT_BRANCHES when below waitFor", async () => {
      await expect(
        node.execute(["only-one"], { strategy: "concat", waitFor: 3 }, ctx)
      ).rejects.toMatchObject({ code: "MERGE_INSUFFICIENT_BRANCHES" });
    });
  });

  // ── Non-array input normalisation ─────────────────────────────────────────

  it("wraps a single non-array value as a one-element branch list", async () => {
    const out = await node.execute(
      "single-value",
      { strategy: "first" },
      ctx
    );
    expect((out.data as { merged: unknown }).merged).toBe("single-value");
  });

  // ── Error cases ───────────────────────────────────────────────────────────

  it("throws MERGE_MISSING_STRATEGY when strategy is absent", async () => {
    await expect(
      node.execute(["a"], {}, ctx)
    ).rejects.toMatchObject({ code: "MERGE_MISSING_STRATEGY" });
  });
});
