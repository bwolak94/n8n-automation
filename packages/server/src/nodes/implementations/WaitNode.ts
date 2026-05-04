import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import { makeSuspendOutput } from "../../engine/SuspendSignal.js";

// ─── Unit conversion ──────────────────────────────────────────────────────────

const UNIT_TO_MS: Record<string, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours:   3_600_000,
  days:    86_400_000,
};

// ─── WaitNode ─────────────────────────────────────────────────────────────────

export class WaitNode implements INode {
  readonly definition: NodeDefinition = {
    type: "wait",
    name: "Wait",
    description:
      "Pause workflow execution for a duration or until a specific datetime, then resume automatically",
    configSchema: {
      type: "object",
      required: ["mode"],
      properties: {
        mode:        { type: "string", enum: ["duration", "until", "webhook"], default: "duration" },
        duration:    {
          type: "object",
          properties: {
            value: { type: "number", minimum: 0 },
            unit:  { type: "string", enum: ["seconds", "minutes", "hours", "days"] },
          },
        },
        until:       { type: "string", description: "ISO datetime (or expression) for 'until' mode" },
        maxWaitDays: { type: "number", minimum: 1, maximum: 365, default: 30 },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const mode        = (config["mode"] as string | undefined) ?? "duration";
    const maxWaitDays = (config["maxWaitDays"] as number | undefined) ?? 30;
    const maxWaitMs   = maxWaitDays * 86_400_000;

    let delayMs: number;

    if (mode === "duration") {
      const dur = config["duration"] as { value: number; unit: string } | undefined;
      if (!dur || dur.value === undefined || dur.value === null) {
        throw new AppError(
          "WaitNode (duration) requires duration.value",
          400,
          "WAIT_MISSING_DURATION"
        );
      }
      const multiplier = UNIT_TO_MS[dur.unit ?? "seconds"];
      if (multiplier === undefined) {
        throw new AppError(
          `WaitNode: unknown unit '${String(dur.unit)}'`,
          400,
          "WAIT_INVALID_UNIT"
        );
      }
      delayMs = dur.value * multiplier;

    } else if (mode === "until") {
      const until = config["until"] as string | undefined;
      if (!until) {
        throw new AppError(
          "WaitNode (until) requires an 'until' datetime",
          400,
          "WAIT_MISSING_UNTIL"
        );
      }
      const target = new Date(until);
      if (isNaN(target.getTime())) {
        throw new AppError(
          `WaitNode: invalid 'until' value '${until}'`,
          400,
          "WAIT_INVALID_UNTIL"
        );
      }
      delayMs = Math.max(0, target.getTime() - Date.now());

    } else if (mode === "webhook") {
      // Webhook mode: wait up to maxWaitDays for an external resume call
      delayMs = maxWaitMs;

    } else {
      throw new AppError(
        `WaitNode: unknown mode '${String(mode)}'`,
        400,
        "WAIT_UNKNOWN_MODE"
      );
    }

    if (delayMs > maxWaitMs) {
      throw new AppError(
        `WaitNode: requested delay (${delayMs}ms) exceeds maxWaitDays limit (${maxWaitMs}ms)`,
        400,
        "WAIT_EXCEEDS_MAX"
      );
    }

    const resumeAfter = new Date(Date.now() + delayMs).toISOString();
    return makeSuspendOutput(input, {
      delayMs,
      resumeAfter,
      mode: mode as "duration" | "until" | "webhook",
    });
  }
}
