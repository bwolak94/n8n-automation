import { describe, expect, it } from "@jest/globals";
import { ConditionalNode } from "../../nodes/implementations/ConditionalNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new ConditionalNode();

// ─── Definition ───────────────────────────────────────────────────────────────

describe("ConditionalNode definition", () => {
  it("has type 'conditional'", () => {
    expect(node.definition.type).toBe("conditional");
  });
  it("has configSchema with required mode", () => {
    expect(node.definition.configSchema.required).toContain("mode");
  });
});

// ─── If mode ─────────────────────────────────────────────────────────────────

describe("ConditionalNode if mode", () => {
  it("routes to branch 0 when condition is true", async () => {
    const output = await node.execute(
      { score: 10 },
      { mode: "if", combinator: "and", conditions: [{ field: "score", operator: "greater_than", value: 5, dataType: "number" }] },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(0);
    expect((output.data as Record<string, unknown>)["result"]).toBe(true);
  });

  it("routes to branch 1 when condition is false", async () => {
    const output = await node.execute(
      { score: 3 },
      { mode: "if", combinator: "and", conditions: [{ field: "score", operator: "greater_than", value: 5, dataType: "number" }] },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(1);
    expect((output.data as Record<string, unknown>)["result"]).toBe(false);
  });

  it("AND combinator: all conditions must pass", async () => {
    const output = await node.execute(
      { a: 10, b: 20 },
      {
        mode: "if",
        combinator: "and",
        conditions: [
          { field: "a", operator: "greater_than", value: 5, dataType: "number" },
          { field: "b", operator: "greater_than", value: 25, dataType: "number" },
        ],
      },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(1);
  });

  it("OR combinator: one condition passing is enough", async () => {
    const output = await node.execute(
      { a: 10, b: 3 },
      {
        mode: "if",
        combinator: "or",
        conditions: [
          { field: "a", operator: "greater_than", value: 5, dataType: "number" },
          { field: "b", operator: "greater_than", value: 5, dataType: "number" },
        ],
      },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(0);
  });

  it("resolves nested dot-path field", async () => {
    const output = await node.execute(
      { user: { role: "admin" } },
      { mode: "if", combinator: "and", conditions: [{ field: "user.role", operator: "equals", value: "admin" }] },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(0);
  });

  it("evaluator error routes to false branch (branch 1)", async () => {
    const output = await node.execute(
      { x: "hello" },
      {
        mode: "if",
        combinator: "and",
        conditions: [{ field: "x", operator: "unknown_bad_op" as never, value: "y" }],
      },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(1);
  });

  it("throws when no conditions provided", async () => {
    await expect(
      node.execute({}, { mode: "if", combinator: "and", conditions: [] }, ctx)
    ).rejects.toThrow("requires at least one condition");
  });

  it("throws when conditions key is missing", async () => {
    await expect(
      node.execute({}, { mode: "if", combinator: "and" }, ctx)
    ).rejects.toThrow();
  });
});

// ─── Switch mode ──────────────────────────────────────────────────────────────

describe("ConditionalNode switch mode", () => {
  const switchConfig = {
    mode: "switch" as const,
    rules: [
      { label: "Low",  combinator: "and" as const, conditions: [{ field: "score", operator: "less_than" as const, value: 10, dataType: "number" as const }] },
      { label: "Mid",  combinator: "and" as const, conditions: [{ field: "score", operator: "less_than" as const, value: 50, dataType: "number" as const }] },
      { label: "High", combinator: "and" as const, conditions: [{ field: "score", operator: "greater_than" as const, value: 49, dataType: "number" as const }] },
    ],
  };

  it("matches first rule (score < 10)", async () => {
    const output = await node.execute({ score: 5 }, switchConfig, ctx);
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(0);
  });

  it("matches second rule (score < 50)", async () => {
    const output = await node.execute({ score: 30 }, switchConfig, ctx);
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(1);
  });

  it("matches third rule (score > 49)", async () => {
    const output = await node.execute({ score: 80 }, switchConfig, ctx);
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(2);
  });

  it("no match: defaults to rules.length", async () => {
    const output = await node.execute(
      { score: 50 },
      {
        mode: "switch",
        rules: [
          { label: "Low", combinator: "and", conditions: [{ field: "score", operator: "less_than", value: 50, dataType: "number" }] },
        ],
      },
      ctx
    );
    // score 50 is NOT less than 50, so no match → branch = rules.length = 1
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(1);
  });

  it("no match with defaultBranchIndex", async () => {
    const output = await node.execute(
      { score: 999 },
      {
        mode: "switch",
        defaultBranchIndex: 42,
        rules: [
          { label: "Low", combinator: "and", conditions: [{ field: "score", operator: "less_than", value: 10, dataType: "number" }] },
        ],
      },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(42);
  });

  it("evaluator error routes to default branch", async () => {
    const output = await node.execute(
      { score: 5 },
      {
        mode: "switch",
        defaultBranchIndex: 7,
        rules: [
          { label: "Bad", combinator: "and", conditions: [{ field: "score", operator: "bad_op" as never, value: 1 }] },
        ],
      },
      ctx
    );
    expect((output.data as Record<string, unknown>)["_branch"]).toBe(7);
  });

  it("throws when rules array is empty", async () => {
    await expect(
      node.execute({}, { mode: "switch", rules: [] }, ctx)
    ).rejects.toThrow("requires at least one rule");
  });

  it("output does not include extra keys besides _branch", async () => {
    const output = await node.execute({ score: 5 }, switchConfig, ctx);
    const keys = Object.keys(output.data as Record<string, unknown>);
    expect(keys).toEqual(["_branch"]);
  });
});

// ─── Unknown mode ─────────────────────────────────────────────────────────────

describe("ConditionalNode unknown mode", () => {
  it("throws for unknown mode", async () => {
    await expect(
      node.execute({}, { mode: "turbo" as never }, ctx)
    ).rejects.toThrow("unknown mode");
  });
});
