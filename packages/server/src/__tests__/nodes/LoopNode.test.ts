import { describe, expect, it } from "@jest/globals";
import { LoopNode } from "../../nodes/implementations/LoopNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new LoopNode();
const items = [1, 2, 3, 4, 5];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LoopNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("loop");
  });

  // ── Direct array input ──────────────────────────────────────────────────

  it("returns all items, last index and total for empty arrayPath", async () => {
    const out = await node.execute(items, { arrayPath: "" }, ctx);
    const data = out.data as { items: unknown[]; index: number; total: number };
    expect(data.items).toEqual(items);
    expect(data.index).toBe(4);
    expect(data.total).toBe(5);
  });

  it("extracts nested array via dot-path", async () => {
    const input = { payload: { data: items } };
    const out = await node.execute(input, { arrayPath: "payload.data" }, ctx);
    const data = out.data as { items: unknown[] };
    expect(data.items).toEqual(items);
  });

  // ── Empty array ─────────────────────────────────────────────────────────

  it("returns index=-1 and total=0 for an empty array", async () => {
    const out = await node.execute([], { arrayPath: "" }, ctx);
    const data = out.data as { items: unknown[]; index: number; total: number };
    expect(data.items).toEqual([]);
    expect(data.index).toBe(-1);
    expect(data.total).toBe(0);
  });

  // ── Sequential batching ─────────────────────────────────────────────────

  it("processes items sequentially with batchSize=2", async () => {
    const out = await node.execute(
      items,
      { arrayPath: "", batchSize: 2, parallel: false },
      ctx
    );
    const data = out.data as { items: unknown[] };
    // Order must be preserved
    expect(data.items).toEqual(items);
  });

  it("processes a single batch when batchSize >= array length", async () => {
    const out = await node.execute(
      items,
      { arrayPath: "", batchSize: 10 },
      ctx
    );
    expect((out.data as { items: unknown[] }).items).toEqual(items);
  });

  // ── Parallel batching ───────────────────────────────────────────────────

  it("processes batches in parallel and returns all items", async () => {
    const out = await node.execute(
      items,
      { arrayPath: "", batchSize: 2, parallel: true },
      ctx
    );
    const data = out.data as { items: unknown[]; total: number };
    expect(data.items).toHaveLength(5);
    expect(data.total).toBe(5);
  });

  it("parallel and sequential produce the same items", async () => {
    const seq = await node.execute(
      items,
      { arrayPath: "", batchSize: 2, parallel: false },
      ctx
    );
    const par = await node.execute(
      items,
      { arrayPath: "", batchSize: 2, parallel: true },
      ctx
    );
    expect((seq.data as { items: unknown[] }).items).toEqual(
      (par.data as { items: unknown[] }).items
    );
  });

  // ── Index tracking ──────────────────────────────────────────────────────

  it("index equals total - 1", async () => {
    const out = await node.execute(
      [10, 20, 30],
      { arrayPath: "" },
      ctx
    );
    const data = out.data as { index: number; total: number };
    expect(data.index).toBe(data.total - 1);
  });

  // ── AbortSignal ─────────────────────────────────────────────────────────

  it("cancels sequential loop when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortCtx: ExecutionContext = { ...ctx, signal: controller.signal };

    await expect(
      node.execute(items, { arrayPath: "" }, abortCtx)
    ).rejects.toThrow("Loop cancelled");
  });

  it("cancels parallel loop when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortCtx: ExecutionContext = { ...ctx, signal: controller.signal };

    await expect(
      node.execute(items, { arrayPath: "", parallel: true }, abortCtx)
    ).rejects.toThrow("Loop cancelled");
  });

  // ── Error cases ─────────────────────────────────────────────────────────

  it("throws LOOP_INVALID_ARRAY when path resolves to non-array", async () => {
    await expect(
      node.execute({ items: "not-an-array" }, { arrayPath: "items" }, ctx)
    ).rejects.toMatchObject({ code: "LOOP_INVALID_ARRAY" });
  });

  it("throws LOOP_MISSING_PATH when arrayPath config is absent", async () => {
    await expect(node.execute(items, {}, ctx)).rejects.toMatchObject({
      code: "LOOP_MISSING_PATH",
    });
  });

  it("throws when nested path does not exist", async () => {
    await expect(
      node.execute({}, { arrayPath: "deep.missing" }, ctx)
    ).rejects.toMatchObject({ code: "LOOP_INVALID_ARRAY" });
  });
});
