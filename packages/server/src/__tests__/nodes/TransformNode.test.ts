import { describe, expect, it } from "@jest/globals";
import { TransformNode } from "../../nodes/implementations/TransformNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new TransformNode();

const products = [
  { name: "Apple", price: 1.0, active: true },
  { name: "Banana", price: 0.5, active: false },
  { name: "Cherry", price: 3.0, active: true },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TransformNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("transform");
  });

  // ── map ──────────────────────────────────────────────────────────────────

  describe("map operation", () => {
    it("maps array to computed values", async () => {
      const out = await node.execute(
        products,
        { operation: "map", expression: "item.price * 2" },
        ctx
      );
      const data = out.data as {
        result: number[];
        inputCount: number;
        outputCount: number;
      };
      expect(data.result).toEqual([2.0, 1.0, 6.0]);
      expect(data.inputCount).toBe(3);
      expect(data.outputCount).toBe(3);
    });

    it("maps to a property value", async () => {
      const out = await node.execute(
        products,
        { operation: "map", expression: "item.name" },
        ctx
      );
      expect((out.data as { result: unknown }).result).toEqual([
        "Apple",
        "Banana",
        "Cherry",
      ]);
    });

    it("handles empty array", async () => {
      const out = await node.execute(
        [],
        { operation: "map", expression: "item" },
        ctx
      );
      expect((out.data as { result: unknown[] }).result).toEqual([]);
    });
  });

  // ── filter ───────────────────────────────────────────────────────────────

  describe("filter operation", () => {
    it("filters by boolean property", async () => {
      const out = await node.execute(
        products,
        { operation: "filter", expression: "item.active" },
        ctx
      );
      const data = out.data as {
        result: typeof products;
        inputCount: number;
        outputCount: number;
      };
      expect(data.result.map((p) => p.name)).toEqual(["Apple", "Cherry"]);
      expect(data.inputCount).toBe(3);
      expect(data.outputCount).toBe(2);
    });

    it("filters by numeric comparison", async () => {
      const out = await node.execute(
        products,
        { operation: "filter", expression: "item.price > 1" },
        ctx
      );
      expect((out.data as { result: unknown[] }).result).toHaveLength(1);
    });

    it("returns empty array when no items match", async () => {
      const out = await node.execute(
        products,
        { operation: "filter", expression: "item.price > 100" },
        ctx
      );
      expect((out.data as { result: unknown[] }).result).toHaveLength(0);
    });
  });

  // ── reduce ───────────────────────────────────────────────────────────────

  describe("reduce operation", () => {
    it("sums numeric values", async () => {
      const out = await node.execute(
        products,
        { operation: "reduce", expression: "acc + item.price", initialValue: 0 },
        ctx
      );
      const data = out.data as { result: number; inputCount: number };
      expect(data.result).toBeCloseTo(4.5);
      expect(data.inputCount).toBe(3);
    });

    it("concatenates strings", async () => {
      const out = await node.execute(
        products,
        {
          operation: "reduce",
          expression: "acc + item.name + ','",
          initialValue: "",
        },
        ctx
      );
      expect((out.data as { result: unknown }).result).toBe(
        "Apple,Banana,Cherry,"
      );
    });

    it("counts items with reduce", async () => {
      const out = await node.execute(
        products,
        { operation: "reduce", expression: "acc + 1", initialValue: 0 },
        ctx
      );
      expect((out.data as { result: unknown }).result).toBe(3);
    });
  });

  // ── Error cases ─────────────────────────────────────────────────────────

  it("throws when input is not an array", async () => {
    await expect(
      node.execute({ not: "array" }, { operation: "map", expression: "item" }, ctx)
    ).rejects.toThrow("expects an array input");
  });

  it("throws for unknown operation", async () => {
    await expect(
      node.execute([], { operation: "unknown", expression: "item" }, ctx)
    ).rejects.toThrow("Unknown operation: unknown");
  });

  it("throws when operation is missing", async () => {
    await expect(
      node.execute([], { expression: "item" }, ctx)
    ).rejects.toThrow("TransformNode requires an operation");
  });

  it("throws when expression is missing", async () => {
    await expect(
      node.execute([], { operation: "map" }, ctx)
    ).rejects.toThrow("TransformNode requires an expression");
  });
});
