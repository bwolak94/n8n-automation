import { describe, it, expect } from "@jest/globals";
import { ExpressionEvaluator } from "../engine/ExpressionEvaluator.js";
import { ExpressionResolutionError } from "../shared/errors/index.js";
import type { ExpressionContext } from "../engine/types.js";

const evaluator = new ExpressionEvaluator();

const ctx: ExpressionContext = {
  nodes: {
    http: { data: { body: { userId: "u-42", nested: { deep: true } } } },
    transform: { data: "hello" },
  },
  variables: { defaultId: "u-default", flag: false },
  trigger: { event: "order.created", orderId: "o-99" },
};

describe("ExpressionEvaluator", () => {
  describe("non-template values", () => {
    it("returns numbers as-is", () => {
      expect(evaluator.evaluate(42, ctx)).toBe(42);
    });

    it("returns booleans as-is", () => {
      expect(evaluator.evaluate(true, ctx)).toBe(true);
    });

    it("returns objects as-is", () => {
      const obj = { a: 1 };
      expect(evaluator.evaluate(obj, ctx)).toBe(obj);
    });

    it("returns plain strings without templates unchanged", () => {
      expect(evaluator.evaluate("hello world", ctx)).toBe("hello world");
    });
  });

  describe("single template — type preservation", () => {
    it("resolves nodes.x.data path", () => {
      expect(evaluator.evaluate("{{nodes.http.data.body.userId}}", ctx)).toBe(
        "u-42"
      );
    });

    it("resolves nested deep path", () => {
      expect(
        evaluator.evaluate("{{nodes.http.data.body.nested.deep}}", ctx)
      ).toBe(true);
    });

    it("resolves variables path", () => {
      expect(evaluator.evaluate("{{variables.defaultId}}", ctx)).toBe(
        "u-default"
      );
    });

    it("resolves trigger path", () => {
      expect(evaluator.evaluate("{{trigger.orderId}}", ctx)).toBe("o-99");
    });

    it("resolves full data object", () => {
      expect(evaluator.evaluate("{{nodes.transform.data}}", ctx)).toBe("hello");
    });
  });

  describe("interpolated templates (multi-template strings)", () => {
    it("interpolates template within a larger string", () => {
      expect(
        evaluator.evaluate("Order: {{trigger.orderId}} by {{trigger.event}}", ctx)
      ).toBe("Order: o-99 by order.created");
    });
  });

  describe("OR fallback", () => {
    it("returns primary when it resolves", () => {
      expect(
        evaluator.evaluate(
          "{{nodes.http.data.body.userId || variables.defaultId}}",
          ctx
        )
      ).toBe("u-42");
    });

    it("falls back when primary path is missing", () => {
      expect(
        evaluator.evaluate(
          "{{nodes.http.data.body.missing || variables.defaultId}}",
          ctx
        )
      ).toBe("u-default");
    });

    it("falls back through multiple misses to last good value", () => {
      expect(
        evaluator.evaluate(
          "{{nodes.missing.data || variables.missing || trigger.orderId}}",
          ctx
        )
      ).toBe("o-99");
    });
  });

  describe("missing path — throws", () => {
    it("throws ExpressionResolutionError for unknown root", () => {
      expect(() =>
        evaluator.evaluate("{{unknown.path}}", ctx)
      ).toThrow(ExpressionResolutionError);
    });

    it("throws when nested path does not exist and no fallback", () => {
      expect(() =>
        evaluator.evaluate("{{nodes.http.data.body.noSuchField}}", ctx)
      ).toThrow(ExpressionResolutionError);
    });

    it("throws when all fallbacks fail", () => {
      expect(() =>
        evaluator.evaluate("{{variables.missing || trigger.missing}}", ctx)
      ).toThrow(ExpressionResolutionError);
    });
  });

  describe("evaluateConfig", () => {
    it("evaluates all values in a config object", () => {
      const result = evaluator.evaluateConfig(
        {
          userId: "{{nodes.http.data.body.userId}}",
          static: "plain",
          count: 7,
        },
        ctx
      );
      expect(result).toEqual({ userId: "u-42", static: "plain", count: 7 });
    });
  });
});
