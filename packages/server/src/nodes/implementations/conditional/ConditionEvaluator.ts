import { AppError } from "../../../shared/errors/index.js";
import type { Condition, Combinator } from "@automation-hub/shared";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isEmpty(val: unknown): boolean {
  return (
    val === null ||
    val === undefined ||
    val === "" ||
    (Array.isArray(val) && val.length === 0)
  );
}

function coerce(val: unknown, dataType: string | undefined): unknown {
  if (dataType === "number") return Number(val);
  if (dataType === "date")   return new Date(String(val)).getTime();
  return val;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluates a single condition against an already-resolved field value.
 * Throws AppError for unknown operators; callers may catch and treat as false.
 */
export function evaluate(condition: Condition, fieldValue: unknown): boolean {
  const left  = coerce(fieldValue,      condition.dataType);
  const right = coerce(condition.value, condition.dataType);

  switch (condition.operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "contains":
      if (Array.isArray(fieldValue)) return fieldValue.includes(condition.value);
      return typeof left === "string" && left.includes(String(right ?? ""));
    case "starts_with":
      return typeof left === "string" && left.startsWith(String(right ?? ""));
    case "ends_with":
      return typeof left === "string" && left.endsWith(String(right ?? ""));
    case "greater_than":
      return (left as number) > (right as number);
    case "less_than":
      return (left as number) < (right as number);
    case "is_empty":
      return isEmpty(fieldValue);
    case "is_not_empty":
      return !isEmpty(fieldValue);
    case "regex": {
      try {
        return new RegExp(String(condition.value ?? "")).test(String(fieldValue ?? ""));
      } catch {
        return false;
      }
    }
    default: {
      const _exhaustive: never = condition.operator;
      throw new AppError(
        `Unknown condition operator: ${String(_exhaustive)}`,
        400,
        "CONDITION_UNKNOWN_OPERATOR"
      );
    }
  }
}

/**
 * Evaluates all conditions using the given combinator.
 * Empty conditions always return true (vacuous truth).
 */
export function evaluateAll(
  conditions: readonly Condition[],
  combinator: Combinator,
  getFieldValue: (field: string) => unknown
): boolean {
  if (conditions.length === 0) return true;
  if (combinator === "and") {
    return conditions.every((c) => evaluate(c, getFieldValue(c.field)));
  }
  return conditions.some((c) => evaluate(c, getFieldValue(c.field)));
}

/**
 * Finds the first matching switch rule and returns its index.
 * Returns `defaultBranchIndex` (or rules.length if undefined) when no rule matches.
 */
export function matchSwitchRule(
  rules: readonly { combinator: Combinator; conditions: readonly Condition[] }[],
  getFieldValue: (field: string) => unknown,
  defaultBranchIndex?: number
): number {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    if (evaluateAll(rule.conditions, rule.combinator, getFieldValue)) return i;
  }
  return defaultBranchIndex ?? rules.length;
}
