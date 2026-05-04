import { evaluate as evaluateCondition } from "../conditional/ConditionEvaluator.js";
import type { TransformOperation } from "@automation-hub/shared";

// ─── Utilities ────────────────────────────────────────────────────────────────

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/** Resolves a dot-path against an object. Returns undefined when path is missing. */
function resolveDotPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((cur: unknown, key: string) => {
    if (!isObject(cur)) return undefined;
    return cur[key];
  }, obj);
}

/**
 * Evaluates a compute expression against the current data.
 * Accepts `input.field.path` or `{{ input.field.path }}` syntax.
 * Returns null on any resolution failure.
 */
function resolveComputeExpr(expression: string, data: unknown): unknown {
  try {
    const expr = expression.replace(/^\s*\{\{\s*/, "").replace(/\s*\}\}\s*$/, "").trim();
    const parts = expr.split(".");
    const root = parts[0];
    if (root !== "input" && root !== "$input") return null;
    const path = parts.slice(1).join(".");
    return resolveDotPath(data, path) ?? null;
  } catch {
    return null;
  }
}

/** Performs a recursive deep merge of `source` into `target`. Non-object values are overwritten. */
function deepMerge(target: unknown, source: unknown): unknown {
  if (!isObject(target) || !isObject(source)) return source;
  const result: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    result[key] = deepMerge(result[key], value);
  }
  return result;
}

// ─── Per-operation applicators ────────────────────────────────────────────────

function applyToEach<T>(
  data: unknown,
  fn: (item: Record<string, unknown>) => Record<string, unknown>
): unknown {
  if (Array.isArray(data)) return data.map((item) => (isObject(item) ? fn(item) : item));
  if (isObject(data)) return fn(data);
  return data;
}

function applyPick(data: unknown, fields: string[]): unknown {
  return applyToEach(data, (obj) =>
    Object.fromEntries(fields.map((f) => [f, obj[f]]))
  );
}

function applyOmit(data: unknown, fields: string[]): unknown {
  const omitSet = new Set(fields);
  return applyToEach(data, (obj) =>
    Object.fromEntries(Object.entries(obj).filter(([k]) => !omitSet.has(k)))
  );
}

function applyRename(data: unknown, mapping: Record<string, string>): unknown {
  return applyToEach(data, (obj) => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[mapping[key] ?? key] = value;
    }
    return result;
  });
}

function applyCompute(data: unknown, field: string, expression: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (!isObject(item)) return item;
      return { ...item, [field]: resolveComputeExpr(expression, item) };
    });
  }
  if (isObject(data)) {
    return { ...data, [field]: resolveComputeExpr(expression, data) };
  }
  return data;
}

function applyFilter(
  data: unknown,
  condition: TransformOperation & { op: "filter" },
  onWarning?: (msg: string) => void
): unknown {
  if (!Array.isArray(data)) {
    onWarning?.("filter op skipped: input is not an array");
    return data;
  }
  return data.filter((item) => {
    const fieldValue = isObject(item) ? resolveDotPath(item, condition.condition.field) : item;
    try {
      return evaluateCondition(condition.condition, fieldValue);
    } catch {
      return false;
    }
  });
}

function applySort(data: unknown, field: string, direction: "asc" | "desc"): unknown {
  if (!Array.isArray(data)) return data;
  const sign = direction === "asc" ? 1 : -1;
  return [...data].sort((a, b) => {
    const av = isObject(a) ? (resolveDotPath(a, field) as number) : (a as number);
    const bv = isObject(b) ? (resolveDotPath(b, field) as number) : (b as number);
    if (av === bv) return 0;
    if (av == null) return sign;
    if (bv == null) return -sign;
    return av < bv ? -sign : sign;
  });
}

function applyGroupBy(data: unknown, field: string): unknown {
  if (!Array.isArray(data)) return data;
  const groups: Record<string, unknown[]> = {};
  for (const item of data) {
    const key = String(isObject(item) ? (resolveDotPath(item, field) ?? "__undefined__") : item);
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(item);
  }
  return groups;
}

function applyFlatten(data: unknown, depth: number | undefined): unknown {
  if (!Array.isArray(data)) return data;
  return data.flat(depth ?? Infinity);
}

function applyMerge(data: unknown, staticData: Record<string, unknown>): unknown {
  return deepMerge(data, staticData);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Applies a list of transform operations sequentially to `data`.
 * Each operation is a closed-form pure function — no eval() used.
 */
export function execute(
  data: unknown,
  operations: readonly TransformOperation[],
  options?: { onWarning?: (msg: string) => void }
): unknown {
  let current = data;

  for (const op of operations) {
    switch (op.op) {
      case "pick":
        current = applyPick(current, op.fields);
        break;
      case "omit":
        current = applyOmit(current, op.fields);
        break;
      case "rename":
        current = applyRename(current, op.mapping);
        break;
      case "compute":
        current = applyCompute(current, op.field, op.expression);
        break;
      case "filter":
        current = applyFilter(current, op, options?.onWarning);
        break;
      case "sort":
        current = applySort(current, op.field, op.direction);
        break;
      case "groupBy":
        current = applyGroupBy(current, op.field);
        break;
      case "flatten":
        current = applyFlatten(current, op.depth);
        break;
      case "merge":
        current = applyMerge(current, op.data);
        break;
    }
  }

  return current;
}
