import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "empty"
  | "not_empty";

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function evaluate(left: unknown, operator: string, right: unknown): boolean {
  switch (operator as Operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return (left as number) > (right as number);
    case "lt":
      return (left as number) < (right as number);
    case "gte":
      return (left as number) >= (right as number);
    case "lte":
      return (left as number) <= (right as number);
    case "contains":
      return typeof left === "string" && left.includes(String(right));
    case "not_contains":
      return typeof left === "string" && !left.includes(String(right));
    case "empty":
      return isEmpty(left);
    case "not_empty":
      return !isEmpty(left);
    default:
      throw new AppError(
        `Unknown operator: ${operator}`,
        400,
        "CONDITION_INVALID_OPERATOR"
      );
  }
}

export class ConditionNode implements INode {
  readonly definition: NodeDefinition = {
    type: "condition",
    name: "Condition",
    description: "Evaluate a boolean expression and route execution",
    configSchema: {
      type: "object",
      required: ["left", "operator"],
      properties: {
        left: { description: "Left-hand side value or expression" },
        operator: {
          type: "string",
          enum: [
            "eq",
            "neq",
            "gt",
            "lt",
            "gte",
            "lte",
            "contains",
            "not_contains",
            "empty",
            "not_empty",
          ],
        },
        right: { description: "Right-hand side value or expression" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const left = config["left"];
    const operator = config["operator"] as string | undefined;
    const right = config["right"];

    if (!operator) {
      throw new AppError(
        "ConditionNode requires an operator",
        400,
        "CONDITION_MISSING_OPERATOR"
      );
    }

    const result = evaluate(left, operator, right);
    const branch: "true" | "false" = result ? "true" : "false";

    return {
      data: { result, branch },
      metadata: { branch },
    };
  }
}
