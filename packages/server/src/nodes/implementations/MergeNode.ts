import { MergeNodeConfigSchema } from "@automation-hub/shared";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { IBranchSyncManager } from "../../engine/BranchSyncManager.js";
import { InMemoryBranchSyncManager } from "../../engine/BranchSyncManager.js";

// ─── Merge-pending sentinel ────────────────────────────────────────────────────

/** Metadata key used to signal that a MergeNode is still waiting for branches. */
export const MERGE_PENDING_KEY = "__merge_pending__" as const;

/** Returns true if the output is a "merge pending" sentinel (branch not yet complete). */
export function isMergePending(output: NodeOutput): boolean {
  return !!(output.metadata && MERGE_PENDING_KEY in output.metadata);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNodeOutput(val: unknown): val is NodeOutput {
  return typeof val === "object" && val !== null && "data" in val;
}

/** Extract raw data from a value that may be a NodeOutput wrapper. */
function unwrap(val: unknown): unknown {
  return isNodeOutput(val) ? val.data : val;
}

// ─── Merge strategies ─────────────────────────────────────────────────────────

type MergeMode = "waitAll" | "mergeByKey" | "append" | "firstWins";

function mergeByKeyStrategy(
  branches: unknown[],
  joinKey: string,
  joinType: "inner" | "left"
): unknown {
  // Normalise each branch to an array of objects
  const arrays = branches.map((b) =>
    Array.isArray(b) ? (b as Record<string, unknown>[]) : [b as Record<string, unknown>]
  );

  const [left = [], ...rest] = arrays;
  const result: Record<string, unknown>[] = [];

  for (const leftItem of left) {
    const keyVal = leftItem[joinKey];
    const merged: Record<string, unknown> = { ...leftItem };
    let matched = true;

    for (const rightArray of rest) {
      const match = rightArray.find((r) => r[joinKey] === keyVal);
      if (match) {
        Object.assign(merged, match);
      } else if (joinType === "inner") {
        matched = false;
        break;
      }
    }

    if (matched) result.push(merged);
  }

  return result;
}

function applyMergeStrategy(
  branches: unknown[],
  mode: MergeMode,
  joinKey: string,
  joinType: "inner" | "left"
): unknown {
  switch (mode) {
    case "waitAll":
      return { branches, branchCount: branches.length };

    case "mergeByKey":
      return mergeByKeyStrategy(branches, joinKey, joinType);

    case "append":
      return branches.flatMap((b) => (Array.isArray(b) ? b : [b]));

    case "firstWins":
      return branches[0];
  }
}

// ─── MergeNode ────────────────────────────────────────────────────────────────

export class MergeNode implements INode {
  readonly definition: NodeDefinition = {
    type: "merge",
    name: "Merge / Join",
    description:
      "Combine outputs from multiple parallel branches (waitAll, mergeByKey, append, firstWins)",
    configSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["waitAll", "mergeByKey", "append", "firstWins"] },
        inputCount: { type: "number", minimum: 2 },
        joinKey: { type: "string" },
        joinType: { type: "string", enum: ["inner", "left"] },
        timeoutMs: { type: "number", minimum: 0 },
      },
    },
  };

  constructor(
    private readonly sync: IBranchSyncManager = new InMemoryBranchSyncManager()
  ) {}

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const parsed = MergeNodeConfigSchema.safeParse(config);
    const {
      mode,
      inputCount,
      joinKey = "id",
      joinType,
    } = parsed.success
      ? parsed.data
      : { mode: "waitAll" as const, inputCount: 2, joinKey: "id", joinType: "inner" as const };

    const branchIndex = (config["branchIndex"] as number | undefined) ?? 0;
    const nodeId = context.nodeId ?? "merge";
    const { executionId } = context;

    // ── Array input: WorkflowRunner collected all branch outputs at once ────────
    if (Array.isArray(input)) {
      const branchData = input.map(unwrap);
      const actualCount = branchData.length;
      await Promise.all(
        branchData.map((item, i) =>
          this.sync.registerBranch(executionId, nodeId, i, item)
        )
      );
      const branches = await this.sync.getAll(executionId, nodeId, actualCount);
      await this.sync.cleanup(executionId, nodeId);
      return { data: applyMergeStrategy(branches, mode, joinKey, joinType) };
    }

    // ── Single-branch call: one branch per execute() invocation ────────────────
    const singleData = unwrap(input);

    if (mode === "firstWins") {
      const count = await this.sync.getCount(executionId, nodeId);
      if (count > 0) {
        // A winner already registered — discard this late arrival
        return { data: null, metadata: { [MERGE_PENDING_KEY]: true } };
      }
      // Register the winner but do NOT clean up: late arrivals need count > 0
      // to be discarded. Redis TTL will expire the key automatically.
      await this.sync.registerBranch(executionId, nodeId, branchIndex, singleData);
      return { data: singleData };
    }

    await this.sync.registerBranch(executionId, nodeId, branchIndex, singleData);

    if (!(await this.sync.isComplete(executionId, nodeId, inputCount))) {
      return { data: null, metadata: { [MERGE_PENDING_KEY]: true } };
    }

    const branches = await this.sync.getAll(executionId, nodeId, inputCount);
    await this.sync.cleanup(executionId, nodeId);
    return { data: applyMergeStrategy(branches, mode, joinKey, joinType) };
  }
}
