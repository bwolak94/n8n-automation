import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

type TimeUnit = "ms" | "s" | "m" | "h";

function toMilliseconds(duration: number, unit: string): number {
  switch (unit as TimeUnit) {
    case "ms":
      return duration;
    case "s":
      return duration * 1_000;
    case "m":
      return duration * 60_000;
    case "h":
      return duration * 3_600_000;
    default:
      throw new AppError(
        `Unknown time unit: ${unit}`,
        400,
        "DELAY_INVALID_UNIT"
      );
  }
}

export class DelayNode implements INode {
  readonly definition: NodeDefinition = {
    type: "delay",
    name: "Delay",
    description: "Pause workflow execution for a specified duration",
    configSchema: {
      type: "object",
      required: ["duration"],
      properties: {
        duration: { type: "number", minimum: 0 },
        unit: {
          type: "string",
          enum: ["ms", "s", "m", "h"],
          default: "ms",
        },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const duration = config["duration"] as number | undefined;
    const unit = (config["unit"] as string | undefined) ?? "ms";

    if (duration === undefined || duration === null) {
      throw new AppError(
        "DelayNode requires a duration",
        400,
        "DELAY_MISSING_DURATION"
      );
    }

    const delayedMs = toMilliseconds(duration, unit);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayedMs);

      if (!context.signal) return;

      if (context.signal.aborted) {
        clearTimeout(timer);
        reject(new Error("Delay cancelled: AbortSignal already aborted"));
        return;
      }

      context.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("Delay cancelled by AbortSignal"));
        },
        { once: true }
      );
    });

    return {
      data: {
        delayedMs,
        resumedAt: new Date().toISOString(),
      },
    };
  }
}
