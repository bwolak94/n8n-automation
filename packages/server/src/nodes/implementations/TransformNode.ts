import vm from "node:vm";
import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

type TransformOperation = "map" | "filter" | "reduce";

function runExpression(
  expression: string,
  sandbox: Record<string, unknown>
): unknown {
  const script = new vm.Script(expression);
  const context = vm.createContext({ ...sandbox });
  return script.runInContext(context, { timeout: 1000 });
}

export class TransformNode implements INode {
  readonly definition: NodeDefinition = {
    type: "transform",
    name: "Transform",
    description: "Apply map, filter, or reduce operations on arrays",
    configSchema: {
      type: "object",
      required: ["operation", "expression"],
      properties: {
        operation: {
          type: "string",
          enum: ["map", "filter", "reduce"],
        },
        expression: {
          type: "string",
          description:
            "Expression evaluated per item. Access `item` (and `acc` for reduce).",
        },
        initialValue: {
          description: "Initial accumulator value for reduce operations",
        },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    if (!Array.isArray(input)) {
      throw new AppError(
        "TransformNode expects an array input",
        400,
        "TRANSFORM_INVALID_INPUT"
      );
    }

    const operation = config["operation"] as string | undefined;
    const expression = config["expression"] as string | undefined;

    if (!operation) {
      throw new AppError(
        "TransformNode requires an operation",
        400,
        "TRANSFORM_MISSING_OPERATION"
      );
    }

    if (!expression) {
      throw new AppError(
        "TransformNode requires an expression",
        400,
        "TRANSFORM_MISSING_EXPRESSION"
      );
    }

    const inputCount = input.length;
    let result: unknown;

    switch (operation as TransformOperation) {
      case "map":
        result = input.map((item) => runExpression(expression, { item }));
        break;
      case "filter":
        result = input.filter((item) =>
          Boolean(runExpression(expression, { item }))
        );
        break;
      case "reduce": {
        const initialValue = config["initialValue"];
        result = input.reduce(
          (acc: unknown, item: unknown) =>
            runExpression(expression, { acc, item }),
          initialValue
        );
        break;
      }
      default:
        throw new AppError(
          `Unknown operation: ${operation}`,
          400,
          "TRANSFORM_INVALID_OPERATION"
        );
    }

    const outputCount = Array.isArray(result) ? result.length : 1;

    return {
      data: { result, inputCount, outputCount },
    };
  }
}
