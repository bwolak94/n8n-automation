import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export class LoopNode implements INode {
  readonly definition: NodeDefinition = {
    type: "loop",
    name: "Loop",
    description:
      "Iterate over an array in batches, with optional parallel execution",
    configSchema: {
      type: "object",
      required: ["arrayPath"],
      properties: {
        arrayPath: {
          type: "string",
          description:
            "Dot-notation path to the array in the input (empty string = use input directly)",
        },
        batchSize: {
          type: "number",
          minimum: 1,
          default: 1,
          description: "Number of items to process per batch",
        },
        parallel: {
          type: "boolean",
          default: false,
          description: "Process batches concurrently when true",
        },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const arrayPath = config["arrayPath"] as string | undefined;
    const batchSize = (config["batchSize"] as number | undefined) ?? 1;
    const parallel = (config["parallel"] as boolean | undefined) ?? false;

    if (arrayPath === undefined || arrayPath === null) {
      throw new AppError(
        "LoopNode requires an arrayPath",
        400,
        "LOOP_MISSING_PATH"
      );
    }

    const array = getNestedValue(input, arrayPath);

    if (!Array.isArray(array)) {
      throw new AppError(
        `LoopNode: path '${arrayPath}' does not resolve to an array`,
        400,
        "LOOP_INVALID_ARRAY"
      );
    }

    const total = array.length;

    if (total === 0) {
      return { data: { items: [], index: -1, total: 0 } };
    }

    const batches = chunk(array, batchSize);
    const processedItems: unknown[] = [];

    if (parallel) {
      const results = await Promise.all(
        batches.map(async (batch) => {
          if (context.signal?.aborted) {
            throw new Error("Loop cancelled by AbortSignal");
          }
          return batch;
        })
      );
      for (const batch of results) {
        processedItems.push(...batch);
      }
    } else {
      for (const batch of batches) {
        if (context.signal?.aborted) {
          throw new Error("Loop cancelled by AbortSignal");
        }
        processedItems.push(...batch);
      }
    }

    return {
      data: {
        items: processedItems,
        index: total - 1,
        total,
      },
    };
  }
}
