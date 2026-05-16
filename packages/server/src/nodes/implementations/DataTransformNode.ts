import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import { execute as runTransforms } from "./transform/TransformExecutor.js";
import type { TransformOperation } from "@automation-hub/shared";

// ─── Dot-path helpers ─────────────────────────────────────────────────────────

function resolveDotPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((cur: unknown, key: string) => {
    if (typeof cur !== "object" || cur === null) return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

/** Immutably sets a value at a dot-path, creating intermediate objects as needed. */
function setDotPath(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  const [head, ...tail] = path.split(".");
  const base: Record<string, unknown> =
    typeof obj === "object" && obj !== null && !Array.isArray(obj)
      ? { ...(obj as Record<string, unknown>) }
      : {};
  base[head!] = tail.length > 0 ? setDotPath(base[head!], tail.join("."), value) : value;
  return base;
}

// ─── DataTransformNode ────────────────────────────────────────────────────────

export class DataTransformNode implements INode {
  readonly definition: NodeDefinition = {
    type: "data_transform",
    name: "Data Transform",
    description:
      "Reshape, filter, map, and aggregate data using composable operations — no code required",
    configSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          description: "Ordered list of transform operations",
        },
        inputField: {
          type: "string",
          description: "Dot-path to a nested field to transform (operates on whole input if absent)",
        },
        outputField: {
          type: "string",
          description: "Dot-path where result is placed in the output (root output if absent)",
        },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const operations = (config["operations"] as TransformOperation[] | undefined) ?? [];
    const inputField  = config["inputField"]  as string | undefined;
    const outputField = config["outputField"] as string | undefined;

    // Resolve the data to transform
    const target = inputField ? resolveDotPath(input, inputField) : input;

    // Apply all operations sequentially
    const transformed = runTransforms(target, operations);

    // Write result back
    const outputData = outputField
      ? setDotPath(input, outputField, transformed)
      : transformed;

    return { data: outputData };
  }
}
