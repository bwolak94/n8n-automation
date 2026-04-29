import { describe, expect, it } from "@jest/globals";
import { JavaScriptNode } from "../../nodes/implementations/JavaScriptNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: { greeting: "hello", count: 3 },
};

const node = new JavaScriptNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("JavaScriptNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("javascript");
  });

  it("executes safe code and returns result + executionMs", async () => {
    const output = await node.execute(
      { value: 21 },
      { code: "return input.value * 2;" },
      ctx
    );
    const data = output.data as { result: unknown; executionMs: number };
    expect(data.result).toBe(42);
    expect(typeof data.executionMs).toBe("number");
    expect(data.executionMs).toBeGreaterThanOrEqual(0);
  });

  it("exposes input in sandbox", async () => {
    const output = await node.execute(
      { name: "world" },
      { code: "return 'Hello, ' + input.name + '!';" },
      ctx
    );
    expect((output.data as { result: unknown }).result).toBe("Hello, world!");
  });

  it("exposes variables in sandbox", async () => {
    const output = await node.execute(
      {},
      { code: "return variables.greeting + ' ' + variables.count;" },
      ctx
    );
    expect((output.data as { result: unknown }).result).toBe("hello 3");
  });

  it("supports returning objects", async () => {
    const output = await node.execute(
      {},
      { code: "return { doubled: 2 * 10 };" },
      ctx
    );
    expect((output.data as { result: unknown }).result).toEqual({ doubled: 20 });
  });

  it("sandbox variables are a snapshot — mutations do not affect context", async () => {
    await node.execute(
      {},
      { code: "variables.greeting = 'mutated';" },
      ctx
    );
    expect(ctx.variables["greeting"]).toBe("hello");
  });

  it("kills runaway code after timeout", async () => {
    await expect(
      node.execute({}, { code: "while(true) {}", timeoutMs: 100 }, ctx)
    ).rejects.toThrow();
  }, 10_000);

  it("blocks require in sandbox", async () => {
    await expect(
      node.execute(
        {},
        { code: "return require('fs').readFileSync('/etc/passwd', 'utf8');" },
        ctx
      )
    ).rejects.toThrow();
  });

  it("blocks eval in sandbox", async () => {
    await expect(
      node.execute({}, { code: "return eval('1 + 1');" }, ctx)
    ).rejects.toThrow();
  });

  it("throws AppError when code is missing", async () => {
    await expect(node.execute({}, {}, ctx)).rejects.toThrow(
      "JavaScriptNode requires code"
    );
  });
});
