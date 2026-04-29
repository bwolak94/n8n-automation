import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

export class SetVariableNode implements INode {
  readonly definition: NodeDefinition = {
    type: "set_variable",
    name: "Set Variable",
    description: "Set a workflow variable for use in subsequent nodes",
    configSchema: {
      type: "object",
      required: ["key", "value"],
      properties: {
        key: { type: "string", description: "Variable name" },
        value: { description: "Variable value" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const key = config["key"] as string | undefined;
    const value = config["value"];

    if (!key) {
      throw new AppError(
        "SetVariableNode requires a key",
        400,
        "SET_VAR_MISSING_KEY"
      );
    }

    context.variables[key] = value;

    return {
      data: {
        key,
        value,
        variables: { ...context.variables },
      },
    };
  }
}
