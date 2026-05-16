import type { NodeOutput } from "../nodes/contracts/INode.js";

/**
 * Key used in NodeOutput.metadata to carry a wait/suspend signal from
 * WaitNode back to WorkflowRunner.
 */
export const WAIT_KEY = "__wait__" as const;

/** Metadata embedded in a WaitNode's output to request suspension. */
export interface WaitSuspendMeta {
  readonly delayMs: number;
  readonly resumeAfter: string; // ISO timestamp
  readonly mode: "duration" | "until" | "webhook";
  readonly webhookId?: string;
}

/** Builds a NodeOutput that carries a suspend signal. */
export function makeSuspendOutput(passThrough: unknown, meta: WaitSuspendMeta): NodeOutput {
  return {
    data: passThrough,
    metadata: { [WAIT_KEY]: meta },
  };
}

/** Returns true if the NodeOutput contains a wait/suspend signal. */
export function isSuspendOutput(output: NodeOutput): boolean {
  return !!(output.metadata && WAIT_KEY in output.metadata);
}

/**
 * Strips the suspend metadata from a NodeOutput.
 * Returns [cleanedOutput, suspendMeta | undefined].
 */
export function extractSuspend(
  output: NodeOutput
): [NodeOutput, WaitSuspendMeta | undefined] {
  const meta = output.metadata as Record<string, unknown> | undefined;
  if (!meta || !(WAIT_KEY in meta)) return [output, undefined];
  const { [WAIT_KEY]: suspend, ...rest } = meta;
  const cleanedMeta = Object.keys(rest).length > 0 ? (rest as Record<string, unknown>) : undefined;
  return [{ ...output, metadata: cleanedMeta }, suspend as WaitSuspendMeta];
}
