import { describe, expect, it } from "@jest/globals";
import { ConditionNode } from "../../nodes/implementations/ConditionNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new ConditionNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ConditionNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("condition");
  });

  // ── True branch ─────────────────────────────────────────────────────────

  describe("true branch", () => {
    it("eq — equal values produce branch=true", async () => {
      const out = await node.execute(
        {},
        { left: 42, operator: "eq", right: 42 },
        ctx
      );
      const data = out.data as { result: boolean; branch: string };
      expect(data.branch).toBe("true");
      expect(data.result).toBe(true);
    });

    it("neq — different values produce branch=true", async () => {
      const out = await node.execute(
        {},
        { left: "a", operator: "neq", right: "b" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("gt — left > right", async () => {
      const out = await node.execute(
        {},
        { left: 10, operator: "gt", right: 5 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("lt — left < right", async () => {
      const out = await node.execute(
        {},
        { left: 3, operator: "lt", right: 5 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("gte — equal values", async () => {
      const out = await node.execute(
        {},
        { left: 5, operator: "gte", right: 5 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("lte — left less than right", async () => {
      const out = await node.execute(
        {},
        { left: 4, operator: "lte", right: 5 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("contains — string includes substring", async () => {
      const out = await node.execute(
        {},
        { left: "hello world", operator: "contains", right: "world" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("not_contains — string does not include substring", async () => {
      const out = await node.execute(
        {},
        { left: "hello", operator: "not_contains", right: "world" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("empty — null value", async () => {
      const out = await node.execute(
        {},
        { left: null, operator: "empty" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("empty — empty string", async () => {
      const out = await node.execute(
        {},
        { left: "", operator: "empty" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("empty — empty array", async () => {
      const out = await node.execute(
        {},
        { left: [], operator: "empty" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });

    it("not_empty — non-empty string", async () => {
      const out = await node.execute(
        {},
        { left: "value", operator: "not_empty" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("true");
    });
  });

  // ── False branch ────────────────────────────────────────────────────────

  describe("false branch", () => {
    it("eq — unequal values produce branch=false", async () => {
      const out = await node.execute(
        {},
        { left: 1, operator: "eq", right: 2 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("false");
    });

    it("gt — left not greater than right", async () => {
      const out = await node.execute(
        {},
        { left: 3, operator: "gt", right: 5 },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("false");
    });

    it("not_empty — null value", async () => {
      const out = await node.execute(
        {},
        { left: null, operator: "not_empty" },
        ctx
      );
      expect((out.data as { branch: string }).branch).toBe("false");
    });
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it("populates metadata.branch", async () => {
    const out = await node.execute(
      {},
      { left: "x", operator: "eq", right: "x" },
      ctx
    );
    expect(out.metadata?.["branch"]).toBe("true");
  });

  // ── Error cases ─────────────────────────────────────────────────────

  it("throws AppError for unknown operator", async () => {
    await expect(
      node.execute(
        {},
        { left: 1, operator: "unknown_op", right: 1 },
        ctx
      )
    ).rejects.toThrow("Unknown operator: unknown_op");
  });

  it("throws AppError when operator is missing", async () => {
    await expect(
      node.execute({}, { left: 1, right: 2 }, ctx)
    ).rejects.toThrow("ConditionNode requires an operator");
  });
});
