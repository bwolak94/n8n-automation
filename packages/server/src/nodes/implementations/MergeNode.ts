import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

type MergeStrategy = "concat" | "zip" | "first" | "last" | "merge_objects";

function zipArrays(branches: unknown[]): unknown[] {
  const arrays = branches.filter(Array.isArray);
  if (arrays.length === 0) return [];
  const maxLen = Math.max(...arrays.map((a) => a.length));
  const result: unknown[] = [];
  for (let i = 0; i < maxLen; i++) {
    result.push(arrays.map((a) => a[i]));
  }
  return result;
}

function mergeByStrategy(branches: unknown[], strategy: MergeStrategy): unknown {
  switch (strategy) {
    case "concat":
      return branches.flatMap((b) => (Array.isArray(b) ? b : [b]));

    case "zip":
      return zipArrays(branches);

    case "first":
      return branches[0];

    case "last":
      return branches[branches.length - 1];

    case "merge_objects":
      return Object.assign(
        {},
        ...branches.filter(
          (b) => typeof b === "object" && b !== null && !Array.isArray(b)
        )
      );

    default: {
      const _never: never = strategy;
      throw new AppError(
        `Unknown merge strategy: ${String(_never)}`,
        400,
        "MERGE_INVALID_STRATEGY"
      );
    }
  }
}

export class MergeNode implements INode {
  readonly definition: NodeDefinition = {
    type: "merge",
    name: "Merge",
    description:
      "Combine outputs from multiple upstream branches using a merge strategy",
    configSchema: {
      type: "object",
      required: ["strategy"],
      properties: {
        strategy: {
          type: "string",
          enum: ["concat", "zip", "first", "last", "merge_objects"],
          description: "How to combine the branch outputs",
        },
        waitFor: {
          type: "number",
          minimum: 1,
          description:
            "Minimum number of branch inputs required before merging",
        },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const strategy = config["strategy"] as MergeStrategy | undefined;
    const waitFor = config["waitFor"] as number | undefined;

    if (!strategy) {
      throw new AppError(
        "MergeNode requires a strategy",
        400,
        "MERGE_MISSING_STRATEGY"
      );
    }

    // Normalise: each upstream branch passes its NodeOutput.data as one element
    const branches = Array.isArray(input) ? input : [input];

    if (waitFor !== undefined && branches.length < waitFor) {
      throw new AppError(
        `MergeNode expected at least ${waitFor} branches but received ${branches.length}`,
        400,
        "MERGE_INSUFFICIENT_BRANCHES"
      );
    }

    const merged = mergeByStrategy(branches, strategy);

    return { data: { merged } };
  }
}
