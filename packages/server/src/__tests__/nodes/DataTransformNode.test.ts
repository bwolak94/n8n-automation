import { describe, it, expect, beforeEach } from "@jest/globals";
import { DataTransformNode } from "../../nodes/implementations/DataTransformNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

function makeContext(): ExecutionContext {
  return { tenantId: "t-1", executionId: "e-1", workflowId: "wf-1", variables: {} };
}

describe("DataTransformNode", () => {
  let node: DataTransformNode;

  beforeEach(() => { node = new DataTransformNode(); });

  it("has correct type", () => {
    expect(node.definition.type).toBe("dataTransform");
  });

  // ── pass-through ─────────────────────────────────────────────────────────────

  it("passes input through unmodified when operations is empty", async () => {
    const input = { a: 1, b: 2 };
    const result = await node.execute(input, { operations: [] }, makeContext());
    expect(result.data).toEqual(input);
  });

  it("passes input through unmodified when operations is missing", async () => {
    const input = { x: 99 };
    const result = await node.execute(input, {}, makeContext());
    expect(result.data).toEqual(input);
  });

  // ── basic operation ────────────────────────────────────────────────────────────

  it("applies a pick operation", async () => {
    const input = { id: 1, name: "Alice", password: "secret" };
    const result = await node.execute(
      input,
      { operations: [{ op: "pick", fields: ["id", "name"] }] },
      makeContext()
    );
    expect(result.data).toEqual({ id: 1, name: "Alice" });
  });

  // ── inputField ────────────────────────────────────────────────────────────────

  it("transforms only the data at inputField and returns it as the output", async () => {
    const input = {
      meta: { version: 1 },
      items: [{ id: 1, secret: "x" }, { id: 2, secret: "y" }],
    };
    const result = await node.execute(
      input,
      {
        operations: [{ op: "omit", fields: ["secret"] }],
        inputField: "items",
      },
      makeContext()
    );
    // Per spec: returns the transformed sub-data (the items array only)
    expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("passes entire input when inputField is not set", async () => {
    const input = { val: 42, extra: "drop" };
    const result = await node.execute(
      input,
      { operations: [{ op: "pick", fields: ["val"] }] },
      makeContext()
    );
    expect(result.data).toEqual({ val: 42 });
  });

  it("resolves a deeply nested inputField", async () => {
    const input = { a: { b: { items: [{ x: 1, y: 2 }] } } };
    const result = await node.execute(
      input,
      { operations: [{ op: "omit", fields: ["y"] }], inputField: "a.b.items" },
      makeContext()
    );
    // Returns the transformed array at a.b.items
    expect(result.data).toEqual([{ x: 1 }]);
  });

  // ── outputField ────────────────────────────────────────────────────────────────

  it("writes result to named outputField in the original input", async () => {
    const input = { raw: [{ id: 1, pw: "x" }], meta: { ok: true } };
    const result = await node.execute(
      input,
      {
        operations:  [{ op: "omit", fields: ["pw"] }],
        inputField:  "raw",
        outputField: "cleaned",
      },
      makeContext()
    );
    const data = result.data as Record<string, unknown>;
    expect(data["cleaned"]).toEqual([{ id: 1 }]);
    expect(data["meta"]).toEqual({ ok: true }); // preserved
  });

  it("writes result to nested outputField dot-path", async () => {
    const input = { val: 10 };
    const result = await node.execute(
      input,
      {
        operations:  [{ op: "merge", data: { extra: true } }],
        outputField: "nested.result",
      },
      makeContext()
    );
    const nested = (result.data as Record<string, Record<string, unknown>>)["nested"];
    expect(nested?.["result"]).toEqual({ val: 10, extra: true });
  });

  // ── inputField + outputField combo ────────────────────────────────────────────

  it("extracts inputField, transforms it, writes to outputField", async () => {
    const input = {
      users: [{ id: 1, pw: "secret" }, { id: 2, pw: "hidden" }],
      meta: { total: 2 },
    };
    const result = await node.execute(
      input,
      {
        operations:  [{ op: "omit", fields: ["pw"] }],
        inputField:  "users",
        outputField: "safeUsers",
      },
      makeContext()
    );
    const data = result.data as Record<string, unknown>;
    expect(data["safeUsers"]).toEqual([{ id: 1 }, { id: 2 }]);
    expect(data["meta"]).toEqual({ total: 2 }); // preserved from original input
  });
});
