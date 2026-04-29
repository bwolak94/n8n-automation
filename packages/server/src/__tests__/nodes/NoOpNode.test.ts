import { describe, expect, it } from "@jest/globals";
import { NoOpNode } from "../../nodes/implementations/NoOpNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new NoOpNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NoOpNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("noop");
  });

  it("passes object input unchanged (same reference)", async () => {
    const input = { key: "value", nested: { arr: [1, 2, 3] } };
    const output = await node.execute(input, {}, ctx);
    expect(output.data).toBe(input);
  });

  it("passes null input unchanged", async () => {
    const output = await node.execute(null, {}, ctx);
    expect(output.data).toBeNull();
  });

  it("passes string input unchanged", async () => {
    const output = await node.execute("hello", {}, ctx);
    expect(output.data).toBe("hello");
  });

  it("passes number input unchanged", async () => {
    const output = await node.execute(42, {}, ctx);
    expect(output.data).toBe(42);
  });

  it("passes array input unchanged (same reference)", async () => {
    const input = [1, 2, 3];
    const output = await node.execute(input, {}, ctx);
    expect(output.data).toBe(input);
  });

  it("passes undefined input unchanged", async () => {
    const output = await node.execute(undefined, {}, ctx);
    expect(output.data).toBeUndefined();
  });

  it("ignores config entirely", async () => {
    const input = { a: 1 };
    const output = await node.execute(
      input,
      { someConfig: "ignored", another: 99 },
      ctx
    );
    expect(output.data).toBe(input);
  });
});
