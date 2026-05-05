import { describe, it, expect, beforeEach } from "@jest/globals";
import { FunctionNode } from "../../nodes/implementations/FunctionNode.js";
import { SandboxExecutor } from "../../nodes/implementations/function/SandboxExecutor.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

function makeCtx(): ExecutionContext {
  return { tenantId: "t-1", executionId: "e-1", workflowId: "wf-1", variables: {} };
}

describe("FunctionNode", () => {
  let node: FunctionNode;

  beforeEach(() => {
    node = new FunctionNode(new SandboxExecutor());
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("function");
  });

  it("executes code and returns output as node data", async () => {
    const out = await node.execute(
      { val: 10 },
      { code: "return { doubled: $input.val * 2 };" },
      makeCtx()
    );
    expect(out.data).toEqual({ doubled: 20 });
  });

  it("captures console.log in metadata.logs", async () => {
    const out = await node.execute(
      null,
      { code: "console.log('test log'); return {};" },
      makeCtx()
    );
    const logs = (out.metadata as Record<string, unknown> | undefined)?.["logs"];
    expect(Array.isArray(logs)).toBe(true);
    expect((logs as string[])[0]).toBe("test log");
  });

  it("omits metadata when no logs", async () => {
    const out = await node.execute(
      null,
      { code: "return { x: 1 };" },
      makeCtx()
    );
    expect(out.metadata).toBeUndefined();
  });

  it("throws FUNCTION_INVALID_CONFIG when code is missing", async () => {
    await expect(
      node.execute(null, {}, makeCtx())
    ).rejects.toMatchObject({ code: "FUNCTION_INVALID_CONFIG" });
  });

  it("throws FUNCTION_TIMEOUT when code exceeds timeoutMs", async () => {
    await expect(
      node.execute(null, { code: "while(true){}", timeoutMs: 100 }, makeCtx())
    ).rejects.toMatchObject({ code: "FUNCTION_TIMEOUT" });
  });

  it("upstream NodeOutput is passed as $input", async () => {
    // Simulate WorkflowRunner passing a NodeOutput object
    const upstreamOutput = { data: { items: [1, 2, 3] } };
    const out = await node.execute(
      upstreamOutput,
      { code: "return { len: $input.data.items.length };" },
      makeCtx()
    );
    expect(out.data).toEqual({ len: 3 });
  });

  it("respects custom timeoutMs config", async () => {
    // 10s timeout — should complete fine
    const out = await node.execute(
      null,
      { code: "return { ok: true };", timeoutMs: 10_000 },
      makeCtx()
    );
    expect(out.data).toEqual({ ok: true });
  });
});
