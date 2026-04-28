import { ExpressionResolutionError } from "../shared/errors/index.js";
import type { ExpressionContext } from "./types.js";

export class ExpressionEvaluator {
  private static readonly SINGLE_TEMPLATE = /^\{\{(.+?)\}\}$/;
  private static readonly TEMPLATE_PATTERN = /\{\{(.+?)\}\}/g;

  /**
   * Evaluates a value that may contain template expressions.
   * - Non-string values are returned as-is.
   * - A string that is entirely one `{{expr}}` returns the resolved value (preserves type).
   * - A string with multiple or embedded templates: each match is stringified and interpolated.
   */
  evaluate(template: unknown, context: ExpressionContext): unknown {
    if (typeof template !== "string") return template;

    const singleMatch = template.match(ExpressionEvaluator.SINGLE_TEMPLATE);
    if (singleMatch) {
      return this.resolveExpression(singleMatch[1].trim(), context);
    }

    return template.replace(
      ExpressionEvaluator.TEMPLATE_PATTERN,
      (_, expr: string) => {
        const value = this.resolveExpression(expr.trim(), context);
        return String(value);
      }
    );
  }

  /**
   * Evaluates all values in a config object.
   */
  evaluateConfig(
    config: Readonly<Record<string, unknown>>,
    context: ExpressionContext
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(config).map(([key, value]) => [
        key,
        this.evaluate(value, context),
      ])
    );
  }

  private resolveExpression(expr: string, context: ExpressionContext): unknown {
    const parts = expr.split("||").map((p) => p.trim());

    for (const part of parts) {
      try {
        return this.resolvePath(part, context);
      } catch {
        // try next fallback
      }
    }

    throw new ExpressionResolutionError(expr);
  }

  private resolvePath(path: string, context: ExpressionContext): unknown {
    const segments = path.split(".");
    const [root, ...rest] = segments;

    let current: unknown;

    switch (root) {
      case "nodes":
        current = context.nodes;
        break;
      case "variables":
        current = context.variables;
        break;
      case "trigger":
        current = context.trigger;
        break;
      default:
        throw new ExpressionResolutionError(path);
    }

    for (const segment of rest) {
      if (current === null || current === undefined || typeof current !== "object") {
        throw new ExpressionResolutionError(path);
      }
      current = (current as Record<string, unknown>)[segment];
    }

    if (current === undefined) {
      throw new ExpressionResolutionError(path);
    }

    return current;
  }
}
