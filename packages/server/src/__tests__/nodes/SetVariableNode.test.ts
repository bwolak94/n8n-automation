import { describe, expect, it } from "@jest/globals";
import { SetVariableNode } from "../../nodes/implementations/SetVariableNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCtx(
  variables: Record<string, unknown> = {}
): ExecutionContext {
  return {
    tenantId: "t-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    variables,
  };
}

const node = new SetVariableNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SetVariableNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("set_variable");
  });

  it("writes the key into context.variables", async () => {
    const ctx = makeCtx();
    await node.execute({}, { key: "userId", value: "u-42" }, ctx);
    expect(ctx.variables["userId"]).toBe("u-42");
  });

  it("returns key, value and snapshot of all variables", async () => {
    const ctx = makeCtx({ existing: "old" });
    const output = await node.execute({}, { key: "newKey", value: 123 }, ctx);
    const data = output.data as {
      key: string;
      value: unknown;
      variables: Record<string, unknown>;
    };
    expect(data.key).toBe("newKey");
    expect(data.value).toBe(123);
    expect(data.variables).toEqual({ existing: "old", newKey: 123 });
  });

  it("overwrites an existing variable", async () => {
    const ctx = makeCtx({ counter: 1 });
    await node.execute({}, { key: "counter", value: 99 }, ctx);
    expect(ctx.variables["counter"]).toBe(99);
  });

  it("supports boolean values", async () => {
    const ctx = makeCtx();
    await node.execute({}, { key: "flag", value: false }, ctx);
    expect(ctx.variables["flag"]).toBe(false);
  });

  it("supports null value", async () => {
    const ctx = makeCtx();
    await node.execute({}, { key: "cleared", value: null }, ctx);
    expect(ctx.variables["cleared"]).toBeNull();
  });

  it("supports complex object values", async () => {
    const ctx = makeCtx();
    const complexValue = { nested: { deep: [1, 2, 3] } };
    await node.execute({}, { key: "config", value: complexValue }, ctx);
    expect(ctx.variables["config"]).toEqual(complexValue);
  });

  it("returned variables snapshot is a copy — does not share reference", async () => {
    const ctx = makeCtx();
    const output = await node.execute({}, { key: "x", value: 1 }, ctx);
    const snapshot = (output.data as { variables: Record<string, unknown> })
      .variables;

    ctx.variables["x"] = 999;
    expect(snapshot["x"]).toBe(1);
  });

  it("throws AppError when key is missing", async () => {
    await expect(
      node.execute({}, { value: "test" }, makeCtx())
    ).rejects.toThrow("SetVariableNode requires a key");
  });
});
