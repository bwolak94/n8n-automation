import { expectTypeOf } from "expect-type";
import { CanvasOpSchema, CanvasOpBatchSchema } from "../schemas/canvas.js";
import type { CanvasOp } from "../types/index.js";

const validOp = {
  id: "op-1",
  workflowId: "wf-1",
  tenantId: "tenant-1",
  userId: "user-1",
  type: "node:add" as const,
  payload: { nodeId: "node-1", position: { x: 0, y: 0 } },
  timestamp: new Date(),
  version: 1,
};

describe("CanvasOpSchema", () => {
  it("parses valid canvas op", () => {
    expect(CanvasOpSchema.safeParse(validOp).success).toBe(true);
  });

  it("accepts all valid op types", () => {
    const types = [
      "node:add",
      "node:update",
      "node:delete",
      "node:move",
      "edge:add",
      "edge:delete",
      "selection:change",
      "viewport:change",
    ] as const;

    for (const type of types) {
      const result = CanvasOpSchema.safeParse({ ...validOp, type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid op type", () => {
    const result = CanvasOpSchema.safeParse({ ...validOp, type: "unknown:op" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("type");
  });

  it("rejects negative version", () => {
    const result = CanvasOpSchema.safeParse({ ...validOp, version: -1 });
    expect(result.success).toBe(false);
  });

  it("inferred CanvasOp type has correct shape", () => {
    expectTypeOf<CanvasOp>().toHaveProperty("workflowId");
    expectTypeOf<CanvasOp>().toHaveProperty("type");
    expectTypeOf<CanvasOp>().toHaveProperty("payload");
  });
});

describe("CanvasOpBatchSchema", () => {
  it("parses valid batch", () => {
    const result = CanvasOpBatchSchema.safeParse({
      workflowId: "wf-1",
      ops: [validOp],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty ops array", () => {
    const result = CanvasOpBatchSchema.safeParse({
      workflowId: "wf-1",
      ops: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("ops");
  });

  it("rejects more than 100 ops", () => {
    const ops = Array.from({ length: 101 }, (_, i) => ({ ...validOp, id: `op-${i}` }));
    const result = CanvasOpBatchSchema.safeParse({ workflowId: "wf-1", ops });
    expect(result.success).toBe(false);
  });
});
