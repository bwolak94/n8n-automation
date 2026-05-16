import { describe, expect, it } from "@jest/globals";
import {
  evaluate,
  evaluateAll,
  matchSwitchRule,
} from "../../nodes/implementations/conditional/ConditionEvaluator.js";
import type { Condition, Combinator } from "@automation-hub/shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cond(
  field: string,
  operator: Condition["operator"],
  value?: unknown,
  dataType?: Condition["dataType"]
): Condition {
  return { field, operator, value, dataType } as Condition;
}

// ─── evaluate() ──────────────────────────────────────────────────────────────

describe("evaluate()", () => {
  // equals
  it("equals: matching strings", () => {
    expect(evaluate(cond("f", "equals", "hello"), "hello")).toBe(true);
  });
  it("equals: non-matching strings", () => {
    expect(evaluate(cond("f", "equals", "hello"), "world")).toBe(false);
  });
  it("equals: number coercion", () => {
    expect(evaluate(cond("f", "equals", "42", "number"), 42)).toBe(true);
  });
  it("equals: number coercion mismatch", () => {
    expect(evaluate(cond("f", "equals", "42", "number"), 43)).toBe(false);
  });

  // not_equals
  it("not_equals: different values", () => {
    expect(evaluate(cond("f", "not_equals", "a"), "b")).toBe(true);
  });
  it("not_equals: same values", () => {
    expect(evaluate(cond("f", "not_equals", "a"), "a")).toBe(false);
  });

  // contains (string)
  it("contains: substring match", () => {
    expect(evaluate(cond("f", "contains", "ell"), "hello")).toBe(true);
  });
  it("contains: substring no match", () => {
    expect(evaluate(cond("f", "contains", "xyz"), "hello")).toBe(false);
  });
  it("contains: array includes", () => {
    expect(evaluate(cond("f", "contains", "b"), ["a", "b", "c"])).toBe(true);
  });
  it("contains: array does not include", () => {
    expect(evaluate(cond("f", "contains", "z"), ["a", "b", "c"])).toBe(false);
  });

  // starts_with
  it("starts_with: matching prefix", () => {
    expect(evaluate(cond("f", "starts_with", "he"), "hello")).toBe(true);
  });
  it("starts_with: non-matching prefix", () => {
    expect(evaluate(cond("f", "starts_with", "wo"), "hello")).toBe(false);
  });
  it("starts_with: non-string value → false", () => {
    expect(evaluate(cond("f", "starts_with", "he"), 42)).toBe(false);
  });

  // ends_with
  it("ends_with: matching suffix", () => {
    expect(evaluate(cond("f", "ends_with", "lo"), "hello")).toBe(true);
  });
  it("ends_with: non-matching suffix", () => {
    expect(evaluate(cond("f", "ends_with", "he"), "hello")).toBe(false);
  });

  // greater_than / less_than
  it("greater_than: left > right", () => {
    expect(evaluate(cond("f", "greater_than", 5, "number"), 10)).toBe(true);
  });
  it("greater_than: left <= right", () => {
    expect(evaluate(cond("f", "greater_than", 10, "number"), 5)).toBe(false);
  });
  it("less_than: left < right", () => {
    expect(evaluate(cond("f", "less_than", 10, "number"), 5)).toBe(true);
  });
  it("less_than: left >= right", () => {
    expect(evaluate(cond("f", "less_than", 5, "number"), 10)).toBe(false);
  });

  // is_empty
  it("is_empty: null → true", () => {
    expect(evaluate(cond("f", "is_empty"), null)).toBe(true);
  });
  it("is_empty: undefined → true", () => {
    expect(evaluate(cond("f", "is_empty"), undefined)).toBe(true);
  });
  it("is_empty: empty string → true", () => {
    expect(evaluate(cond("f", "is_empty"), "")).toBe(true);
  });
  it("is_empty: empty array → true", () => {
    expect(evaluate(cond("f", "is_empty"), [])).toBe(true);
  });
  it("is_empty: non-empty string → false", () => {
    expect(evaluate(cond("f", "is_empty"), "hello")).toBe(false);
  });
  it("is_empty: 0 → false", () => {
    expect(evaluate(cond("f", "is_empty"), 0)).toBe(false);
  });

  // is_not_empty
  it("is_not_empty: non-empty string → true", () => {
    expect(evaluate(cond("f", "is_not_empty"), "hello")).toBe(true);
  });
  it("is_not_empty: null → false", () => {
    expect(evaluate(cond("f", "is_not_empty"), null)).toBe(false);
  });
  it("is_not_empty: empty array → false", () => {
    expect(evaluate(cond("f", "is_not_empty"), [])).toBe(false);
  });

  // regex
  it("regex: matching pattern", () => {
    expect(evaluate(cond("f", "regex", "^\\d+$"), "123")).toBe(true);
  });
  it("regex: non-matching pattern", () => {
    expect(evaluate(cond("f", "regex", "^\\d+$"), "abc")).toBe(false);
  });
  it("regex: invalid pattern → false (no throw)", () => {
    expect(evaluate(cond("f", "regex", "[invalid"), "test")).toBe(false);
  });

  // date coercion: both sides are date strings, coercion converts to timestamps
  it("equals: date coercion compares equal date strings", () => {
    expect(evaluate(cond("f", "equals", "2024-01-01", "date"), "2024-01-01")).toBe(true);
  });
  it("equals: date coercion detects different dates", () => {
    expect(evaluate(cond("f", "equals", "2024-01-02", "date"), "2024-01-01")).toBe(false);
  });
  it("greater_than: date coercion compares chronologically", () => {
    expect(evaluate(cond("f", "greater_than", "2024-01-01", "date"), "2024-01-02")).toBe(true);
  });

  // unknown operator throws
  it("unknown operator: throws AppError", () => {
    const bad = { field: "f", operator: "unknown_op" as never, value: "x" };
    expect(() => evaluate(bad, "x")).toThrow();
  });
});

// ─── evaluateAll() ────────────────────────────────────────────────────────────

describe("evaluateAll()", () => {
  const get = (val: unknown) => (_field: string) => val;

  it("empty conditions → true (vacuous truth)", () => {
    expect(evaluateAll([], "and", get("anything"))).toBe(true);
  });

  it("AND: all true → true", () => {
    const conditions = [
      cond("score", "greater_than", 5, "number"),
      cond("score", "less_than", 20, "number"),
    ];
    expect(evaluateAll(conditions, "and", get(10))).toBe(true);
  });

  it("AND: one false → false", () => {
    const conditions = [
      cond("score", "greater_than", 5, "number"),
      cond("score", "less_than", 8, "number"),
    ];
    expect(evaluateAll(conditions, "and", get(10))).toBe(false);
  });

  it("OR: one true → true", () => {
    const conditions = [
      cond("val", "equals", "a"),
      cond("val", "equals", "b"),
    ];
    expect(evaluateAll(conditions, "or", (_f) => "b")).toBe(true);
  });

  it("OR: all false → false", () => {
    const conditions = [
      cond("val", "equals", "a"),
      cond("val", "equals", "b"),
    ];
    expect(evaluateAll(conditions, "or", (_f) => "z")).toBe(false);
  });

  it("uses getFieldValue to resolve field name", () => {
    const getFieldValue = (field: string) => (field === "name" ? "alice" : "");
    const conditions = [cond("name", "equals", "alice")];
    expect(evaluateAll(conditions, "and", getFieldValue)).toBe(true);
  });
});

// ─── matchSwitchRule() ────────────────────────────────────────────────────────

describe("matchSwitchRule()", () => {
  const get = (val: unknown) => (_field: string) => val;

  const rules = [
    { combinator: "and" as Combinator, conditions: [cond("x", "equals", "a")] },
    { combinator: "and" as Combinator, conditions: [cond("x", "equals", "b")] },
    { combinator: "and" as Combinator, conditions: [cond("x", "equals", "c")] },
  ];

  it("matches first rule at index 0", () => {
    expect(matchSwitchRule(rules, get("a"))).toBe(0);
  });

  it("matches second rule at index 1", () => {
    expect(matchSwitchRule(rules, get("b"))).toBe(1);
  });

  it("matches third rule at index 2", () => {
    expect(matchSwitchRule(rules, get("c"))).toBe(2);
  });

  it("no match: returns rules.length by default", () => {
    expect(matchSwitchRule(rules, get("z"))).toBe(3);
  });

  it("no match: returns provided defaultBranchIndex", () => {
    expect(matchSwitchRule(rules, get("z"), 99)).toBe(99);
  });

  it("returns first matching rule (short-circuits)", () => {
    const overlapping = [
      { combinator: "and" as Combinator, conditions: [cond("x", "is_not_empty")] },
      { combinator: "and" as Combinator, conditions: [cond("x", "equals", "hello")] },
    ];
    expect(matchSwitchRule(overlapping, get("hello"))).toBe(0);
  });

  it("empty conditions rule matches immediately", () => {
    const withEmpty = [
      { combinator: "and" as Combinator, conditions: [] },
    ];
    expect(matchSwitchRule(withEmpty, get("anything"))).toBe(0);
  });
});
