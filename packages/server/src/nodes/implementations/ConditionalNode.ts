import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { Condition, Combinator } from "@automation-hub/shared";
import {
  evaluateAll,
  matchSwitchRule,
} from "./conditional/ConditionEvaluator.js";

// ─── Field-path resolver ───────────────────────────────────────────────────────

/** Resolves a dot-path against the node's input object. */
function resolveDotPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ─── ConditionalNode ───────────────────────────────────────────────────────────

export class ConditionalNode implements INode {
  readonly definition: NodeDefinition = {
    type: "conditional",
    name: "Conditional",
    description:
      "Branch workflow execution based on conditions (if/else or switch-style routing)",
    configSchema: {
      type: "object",
      required: ["mode"],
      properties: {
        mode:               { type: "string", enum: ["if", "switch"] },
        combinator:         { type: "string", enum: ["and", "or"], default: "and" },
        conditions:         { type: "array", description: "Conditions for 'if' mode" },
        rules:              { type: "array", description: "Rules for 'switch' mode" },
        defaultBranchIndex: { type: "number", description: "Branch taken when no switch rule matches" },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const mode = config["mode"] as string | undefined;
    const getFieldValue = (field: string): unknown => resolveDotPath(input, field);

    // ── If / Else mode ────────────────────────────────────────────────────────

    if (mode === "if") {
      const conditions = config["conditions"] as Condition[] | undefined;
      const combinator = (config["combinator"] as Combinator | undefined) ?? "and";

      if (!conditions || conditions.length === 0) {
        throw new AppError(
          "ConditionalNode (if) requires at least one condition",
          400,
          "CONDITIONAL_MISSING_CONDITIONS"
        );
      }

      let result: boolean;
      try {
        result = evaluateAll(conditions, combinator, getFieldValue);
      } catch {
        // Expression / evaluator errors → route to false branch
        result = false;
      }

      return {
        data: { _branch: result ? 0 : 1, result },
      };
    }

    // ── Switch mode ───────────────────────────────────────────────────────────

    if (mode === "switch") {
      type SwitchRule = { label: string; combinator: Combinator; conditions: Condition[] };
      const rules = config["rules"] as SwitchRule[] | undefined;
      const defaultBranchIndex = config["defaultBranchIndex"] as number | undefined;

      if (!rules || rules.length === 0) {
        throw new AppError(
          "ConditionalNode (switch) requires at least one rule",
          400,
          "CONDITIONAL_MISSING_RULES"
        );
      }

      let branchIndex: number;
      try {
        branchIndex = matchSwitchRule(rules, getFieldValue, defaultBranchIndex);
      } catch {
        branchIndex = defaultBranchIndex ?? rules.length;
      }

      return { data: { _branch: branchIndex } };
    }

    throw new AppError(
      `ConditionalNode: unknown mode '${String(mode)}'`,
      400,
      "CONDITIONAL_UNKNOWN_MODE"
    );
  }
}
