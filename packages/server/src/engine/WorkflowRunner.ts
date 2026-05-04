import { NotFoundError, AppError } from "../shared/errors/index.js";
import type { ExecutionContext, NodeOutput } from "../nodes/contracts/INode.js";
import type { NodeExecutor } from "./NodeExecutor.js";
import type { TopologicalSorter } from "./TopologicalSorter.js";
import type { EventBus } from "./EventBus.js";
import type {
  ExpressionContext,
  ExecutionResult,
  IWorkflowRepository,
  IExecutionLogRepository,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  ExecutionLog,
  SuspendedExecutionState,
} from "./types.js";
import { extractSuspend } from "./SuspendSignal.js";
import type { WaitSuspendMeta } from "./SuspendSignal.js";

// ─── IResumableQueue ──────────────────────────────────────────────────────────

/** Minimal queue interface needed to enqueue delayed resume jobs. */
export interface IResumableQueue {
  enqueueResume(executionId: string, tenantId: string, delayMs: number): Promise<string>;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type GroupLoopResult =
  | { readonly type: "completed"; readonly outputs: Record<string, NodeOutput> }
  | {
      readonly type: "suspended";
      readonly outputs: Record<string, NodeOutput>;
      readonly activeBranches: Map<string, number>;
      readonly skippedNodes: Set<string>;
      readonly suspendMeta: WaitSuspendMeta;
      readonly remainingGroups: string[][];
    };

// ─── Branch routing helpers ────────────────────────────────────────────────────

/**
 * Returns true if a node should be skipped due to conditional branching.
 * A node is skipped when ALL of its incoming edges are inactive:
 *   - an edge is inactive if its source was skipped, OR
 *   - the source node output a _branch that doesn't match this edge's sourceHandle.
 */
function shouldSkipNode(
  nodeId: string,
  edges: readonly WorkflowEdge[],
  skippedNodes: ReadonlySet<string>,
  activeBranches: ReadonlyMap<string, number>
): boolean {
  const incoming = edges.filter((e) => e.to === nodeId);
  if (incoming.length === 0) return false; // trigger/root node — always runs

  return incoming.every((edge) => {
    if (skippedNodes.has(edge.from)) return true; // source was skipped
    const activeBranch = activeBranches.get(edge.from);
    if (activeBranch !== undefined) {
      // Source is a conditional node — only the matching branch edge is active
      return edge.sourceHandle !== String(activeBranch);
    }
    return false; // source is a normal node, edge is active
  });
}

/**
 * Extracts _branch from a node output, strips it from the stored data,
 * and returns [cleanedOutput, branchIndex | undefined].
 */
function extractBranch(
  output: NodeOutput
): [NodeOutput, number | undefined] {
  const data = output.data;
  if (typeof data !== "object" || data === null || !("_branch" in data)) {
    return [output, undefined];
  }
  const raw = data as Record<string, unknown>;
  const branch = raw["_branch"] as number;
  const { _branch: _, ...rest } = raw;
  return [{ ...output, data: rest }, branch];
}

// ─── Loop helpers ──────────────────────────────────────────────────────────────

/** Resolves a dot-path against an object. Empty path returns the object itself. */
function resolveDotPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, obj);
}

/** Splits an array into consecutive chunks of the given size. */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Returns true if the value looks like a NodeOutput ({ data: ... }).
 * Used to auto-unwrap the input before resolving the loop array path.
 */
function isNodeOutput(val: unknown): val is NodeOutput {
  return typeof val === "object" && val !== null && "data" in val;
}

// ─── WorkflowRunner ────────────────────────────────────────────────────────────

export class WorkflowRunner {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionLogRepo: IExecutionLogRepository,
    private readonly nodeExecutor: NodeExecutor,
    private readonly sorter: TopologicalSorter,
    private readonly eventBus: EventBus,
    private readonly queue?: IResumableQueue
  ) {}

  async run(
    workflowId: string,
    tenantId: string,
    triggerData: Record<string, unknown>,
    opts?: { depth?: number; parentExecutionId?: string }
  ): Promise<ExecutionResult> {
    const workflow = await this.workflowRepo.findById(workflowId, tenantId);
    if (!workflow) {
      throw new NotFoundError(`Workflow '${workflowId}' not found`);
    }

    const depth = opts?.depth ?? 0;
    const parentExecutionId = opts?.parentExecutionId;

    const log = await this.executionLogRepo.create({
      workflowId,
      tenantId,
      status: "running",
      startedAt: new Date(),
      ...(parentExecutionId !== undefined ? { parentExecutionId } : {}),
    });

    const executionContext: ExecutionContext = {
      tenantId,
      depth,
      ...(parentExecutionId !== undefined ? { parentExecutionId } : {}),
      executionId: log.id,
      workflowId,
      variables: { ...(workflow.variables ?? {}) },
    };

    await this.eventBus.emit("execution.started", {
      executionId: log.id,
      workflowId,
      tenantId,
      startedAt: log.startedAt,
    });

    // ── Separate main nodes from loop-scoped inner nodes ───────────────────────
    const mainNodes = workflow.nodes.filter((n) => !n.loopNodeId);
    const mainNodeIdSet = new Set(mainNodes.map((n) => n.id));

    const innerNodesByLoop = new Map<string, WorkflowNode[]>();
    for (const node of workflow.nodes) {
      if (node.loopNodeId) {
        const arr = innerNodesByLoop.get(node.loopNodeId) ?? [];
        arr.push(node);
        innerNodesByLoop.set(node.loopNodeId, arr);
      }
    }

    const mainEdges = workflow.edges.filter(
      (e) => mainNodeIdSet.has(e.from) && mainNodeIdSet.has(e.to)
    );
    const innerEdgesByLoop = new Map<string, WorkflowEdge[]>();
    for (const [loopId, nodes] of innerNodesByLoop) {
      const innerIdSet = new Set(nodes.map((n) => n.id));
      innerEdgesByLoop.set(
        loopId,
        workflow.edges.filter((e) => innerIdSet.has(e.from) && innerIdSet.has(e.to))
      );
    }
    // ──────────────────────────────────────────────────────────────────────────

    const outputs: Record<string, NodeOutput> = {};
    /** nodeId → active branch index (for conditional nodes) */
    const activeBranches = new Map<string, number>();
    /** nodes that were pruned by a branch and should not execute */
    const skippedNodes = new Set<string>();

    try {
      const groups = this.sorter.sort(mainNodes.map((n) => n.id), mainEdges);

      const loopResult = await this.executeRemainingGroups(
        groups, mainNodes, mainEdges, innerNodesByLoop, innerEdgesByLoop,
        outputs, activeBranches, skippedNodes, executionContext, triggerData, log
      );

      if (loopResult.type === "suspended") {
        await this.handleSuspend(log, tenantId, workflowId, triggerData, loopResult);
        return { executionId: log.id, status: "waiting", outputs: loopResult.outputs };
      }

      const completedAt = new Date();
      await this.executionLogRepo.update(log.id, {
        status: "completed",
        completedAt,
      });

      await this.eventBus.emit("execution.completed", {
        executionId: log.id,
        workflowId,
        tenantId,
        completedAt,
        outputs: loopResult.outputs,
      });

      return { executionId: log.id, status: "completed", outputs: loopResult.outputs };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const failedAt = new Date();

      await this.executionLogRepo.update(log.id, {
        status: "failed",
        completedAt: failedAt,
        error: error.message,
      });

      await this.eventBus.emit("execution.failed", {
        executionId: log.id,
        workflowId,
        tenantId,
        failedAt,
        error,
      });

      return { executionId: log.id, status: "failed", outputs, error };
    }
  }

  // ─── Resume a suspended execution ──────────────────────────────────────────

  async resume(executionId: string, tenantId: string): Promise<ExecutionResult> {
    const state = await this.executionLogRepo.loadSuspendedState?.(executionId, tenantId) ?? null;
    if (!state) {
      throw new NotFoundError(`Suspended execution '${executionId}' not found`);
    }

    const workflow = await this.workflowRepo.findById(state.workflowId, tenantId);
    if (!workflow) {
      throw new NotFoundError(`Workflow '${state.workflowId}' not found`);
    }

    // Re-derive topology from the workflow definition
    const mainNodes = workflow.nodes.filter((n) => !n.loopNodeId);
    const mainNodeIdSet = new Set(mainNodes.map((n) => n.id));
    const mainEdges = workflow.edges.filter(
      (e) => mainNodeIdSet.has(e.from) && mainNodeIdSet.has(e.to)
    );
    const innerNodesByLoop = new Map<string, WorkflowNode[]>();
    for (const node of workflow.nodes) {
      if (node.loopNodeId) {
        const arr = innerNodesByLoop.get(node.loopNodeId) ?? [];
        arr.push(node);
        innerNodesByLoop.set(node.loopNodeId, arr);
      }
    }
    const innerEdgesByLoop = new Map<string, WorkflowEdge[]>();
    for (const [loopId, nodes] of innerNodesByLoop) {
      const innerIdSet = new Set(nodes.map((n) => n.id));
      innerEdgesByLoop.set(
        loopId,
        workflow.edges.filter((e) => innerIdSet.has(e.from) && innerIdSet.has(e.to))
      );
    }

    // Restore execution state
    const outputs = state.outputs as Record<string, NodeOutput>;
    const activeBranches = new Map<string, number>(state.activeBranches);
    const skippedNodes = new Set<string>(state.skippedNodes);

    const executionContext: ExecutionContext = {
      tenantId,
      executionId,
      workflowId: state.workflowId,
      variables: { ...(workflow.variables ?? {}) },
    };

    const fakeLog: ExecutionLog = {
      id: executionId,
      workflowId: state.workflowId,
      tenantId,
      status: "running",
      startedAt: new Date(),
    };

    await this.executionLogRepo.update(executionId, { status: "running" });

    try {
      const loopResult = await this.executeRemainingGroups(
        state.remainingGroups, mainNodes, mainEdges, innerNodesByLoop, innerEdgesByLoop,
        outputs, activeBranches, skippedNodes, executionContext, state.triggerData, fakeLog
      );

      if (loopResult.type === "suspended") {
        await this.handleSuspend(fakeLog, tenantId, state.workflowId, state.triggerData, loopResult);
        return { executionId, status: "waiting", outputs: loopResult.outputs };
      }

      const completedAt = new Date();
      await this.executionLogRepo.update(executionId, { status: "completed", completedAt });
      await this.eventBus.emit("execution.completed", {
        executionId,
        workflowId: state.workflowId,
        tenantId,
        completedAt,
        outputs: loopResult.outputs,
      });
      return { executionId, status: "completed", outputs: loopResult.outputs };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const failedAt = new Date();
      await this.executionLogRepo.update(executionId, {
        status: "failed",
        completedAt: failedAt,
        error: error.message,
      });
      await this.eventBus.emit("execution.failed", {
        executionId,
        workflowId: state.workflowId,
        tenantId,
        failedAt,
        error,
      });
      return { executionId, status: "failed", outputs, error };
    }
  }

  // ─── Core group execution loop ─────────────────────────────────────────────

  /**
   * Executes an ordered list of topological groups, mutating the provided
   * `outputs`, `activeBranches`, and `skippedNodes` maps in place.
   *
   * Returns either a "completed" result or a "suspended" result when a WaitNode
   * fires.  Throws on node failure (caller's try/catch handles it).
   */
  private async executeRemainingGroups(
    groups: string[][],
    mainNodes: WorkflowNode[],
    mainEdges: readonly WorkflowEdge[],
    innerNodesByLoop: Map<string, WorkflowNode[]>,
    innerEdgesByLoop: Map<string, WorkflowEdge[]>,
    outputs: Record<string, NodeOutput>,
    activeBranches: Map<string, number>,
    skippedNodes: Set<string>,
    executionContext: ExecutionContext,
    triggerData: Record<string, unknown>,
    log: ExecutionLog
  ): Promise<GroupLoopResult> {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const group = groups[groupIndex]!;

      const results = await Promise.allSettled(
        group.map(async (nodeId) => {
          if (shouldSkipNode(nodeId, mainEdges, skippedNodes, activeBranches)) {
            skippedNodes.add(nodeId);
            return { data: null, metadata: { skipped: true } } as NodeOutput;
          }

          const node = mainNodes.find((n) => n.id === nodeId)!;

          const expressionContext: ExpressionContext = {
            nodes: outputs,
            variables: executionContext.variables,
            trigger: triggerData,
          };

          const parentEdges = mainEdges.filter((e) => e.to === nodeId);
          const activeParentEdges = parentEdges.filter((e) => {
            if (skippedNodes.has(e.from)) return false;
            const branch = activeBranches.get(e.from);
            return branch === undefined || e.sourceHandle === String(branch);
          });
          // Multi-input nodes (e.g. MergeNode) receive an array of all parent outputs.
          const input =
            activeParentEdges.length === 0
              ? triggerData
              : activeParentEdges.length === 1
                ? outputs[activeParentEdges[0]!.from]
                : activeParentEdges.map((e) => outputs[e.from]);

          const stepStartedAt = new Date();
          const step = await this.executionLogRepo.createStep({
            executionId: log.id,
            nodeId,
            nodeType: node.type,
            status: "running",
            input,
            startedAt: stepStartedAt,
          });

          try {
            const output =
              node.type === "loop"
                ? await this.executeLoop(
                    node, input,
                    innerNodesByLoop.get(nodeId) ?? [],
                    innerEdgesByLoop.get(nodeId) ?? [],
                    expressionContext, executionContext
                  )
                : await this.nodeExecutor.execute(node, input, expressionContext, executionContext);

            const completedAt = new Date();
            await this.executionLogRepo.updateStep(step.id, {
              status: "completed",
              output: output.data,
              completedAt,
              durationMs: completedAt.getTime() - stepStartedAt.getTime(),
            });
            return output;
          } catch (err) {
            const completedAt = new Date();
            await this.executionLogRepo.updateStep(step.id, {
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
              completedAt,
              durationMs: completedAt.getTime() - stepStartedAt.getTime(),
            });
            throw err;
          }
        })
      );

      const firstFailure = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      if (firstFailure) {
        throw firstFailure.reason instanceof Error
          ? firstFailure.reason
          : new Error(String(firstFailure.reason));
      }

      let suspendMeta: WaitSuspendMeta | undefined;

      for (let i = 0; i < group.length; i++) {
        const nodeId = group[i]!;
        if (skippedNodes.has(nodeId)) continue;

        const result = results[i] as PromiseFulfilledResult<NodeOutput>;
        const [afterBranch, branch] = extractBranch(result.value);
        const [cleanedOutput, suspend] = extractSuspend(afterBranch);
        outputs[nodeId] = cleanedOutput;
        if (branch !== undefined) activeBranches.set(nodeId, branch);
        if (suspend !== undefined && suspendMeta === undefined) {
          suspendMeta = suspend;
        }
      }

      if (suspendMeta !== undefined) {
        return {
          type: "suspended",
          outputs,
          activeBranches,
          skippedNodes,
          suspendMeta,
          remainingGroups: groups.slice(groupIndex + 1),
        };
      }
    }

    return { type: "completed", outputs };
  }

  // ─── Suspension handler ────────────────────────────────────────────────────

  private async handleSuspend(
    log: ExecutionLog,
    tenantId: string,
    workflowId: string,
    triggerData: Record<string, unknown>,
    suspended: Extract<GroupLoopResult, { type: "suspended" }>
  ): Promise<void> {
    const resumeAfter = new Date(suspended.suspendMeta.resumeAfter);

    const state: SuspendedExecutionState = {
      workflowId,
      triggerData,
      outputs: suspended.outputs,
      remainingGroups: suspended.remainingGroups,
      activeBranches: [...suspended.activeBranches.entries()],
      skippedNodes: [...suspended.skippedNodes],
    };

    await this.executionLogRepo.suspend?.(log.id, resumeAfter, state);

    if (this.queue) {
      await this.queue.enqueueResume(log.id, tenantId, suspended.suspendMeta.delayMs);
    }

    await this.eventBus.emit("execution.waiting", {
      executionId: log.id,
      workflowId,
      tenantId,
      resumeAfter,
    });
  }

  // ─── Loop execution ─────────────────────────────────────────────────────────

  private async executeLoop(
    loopNode: WorkflowNode,
    input: unknown,
    innerNodes: readonly WorkflowNode[],
    innerEdges: readonly WorkflowEdge[],
    expressionContext: ExpressionContext,
    executionContext: ExecutionContext
  ): Promise<NodeOutput> {
    const cfg = loopNode.config;
    const inputField = (cfg["inputField"] as string | undefined) ?? "";
    const batchSize = Math.max(1, (cfg["batchSize"] as number | undefined) ?? 1);
    const collectResults = (cfg["collectResults"] as boolean | undefined) ?? false;
    const continueOnError = (cfg["continueOnError"] as boolean | undefined) ?? false;
    const maxIterations = (cfg["maxIterations"] as number | undefined) ?? 1000;

    // Auto-unwrap NodeOutput so users specify path relative to the data object
    const rawInput = isNodeOutput(input) ? (input as NodeOutput).data : input;
    const array = resolveDotPath(rawInput, inputField);

    if (!Array.isArray(array)) {
      throw new AppError(
        `LoopNode: inputField '${inputField}' does not resolve to an array`,
        400,
        "LOOP_INVALID_ARRAY"
      );
    }

    if (array.length > maxIterations) {
      throw new AppError(
        `Loop limit exceeded: array length ${array.length} exceeds maxIterations ${maxIterations}`,
        400,
        "LOOP_LIMIT_EXCEEDED"
      );
    }

    if (array.length === 0) {
      return { data: { results: [], total: 0 } };
    }

    const results: (NodeOutput | null)[] = new Array(array.length).fill(null);
    const batches = chunkArray(array, batchSize);
    let globalIndex = 0;

    for (const batch of batches) {
      const settled = await Promise.allSettled(
        batch.map(async (item, batchLocalIdx) => {
          const itemIndex = globalIndex + batchLocalIdx;
          const output = await this.executeSubChain(
            item,
            itemIndex,
            innerNodes,
            innerEdges,
            expressionContext,
            executionContext
          );
          return { index: itemIndex, output };
        })
      );

      for (const r of settled) {
        if (r.status === "fulfilled") {
          results[r.value.index] = r.value.output;
        } else if (!continueOnError) {
          throw r.reason instanceof Error ? r.reason : new Error(String(r.reason));
        }
        // continueOnError: failed item stays null in results
      }

      globalIndex += batch.length;
    }

    if (collectResults) {
      return {
        data: {
          results: results.filter((r) => r !== null),
          total: array.length,
        },
      };
    }

    return {
      data: {
        total: array.length,
        processed: results.filter((r) => r !== null).length,
      },
    };
  }

  private async executeSubChain(
    item: unknown,
    itemIndex: number,
    innerNodes: readonly WorkflowNode[],
    innerEdges: readonly WorkflowEdge[],
    outerExpressionContext: ExpressionContext,
    executionContext: ExecutionContext
  ): Promise<NodeOutput> {
    if (innerNodes.length === 0) {
      return { data: { index: itemIndex, value: item } };
    }

    const groups = this.sorter.sort(
      innerNodes.map((n) => n.id),
      innerEdges
    );

    const innerOutputs: Record<string, NodeOutput> = {};

    for (const group of groups) {
      const results = await Promise.allSettled(
        group.map(async (nodeId) => {
          const node = innerNodes.find((n) => n.id === nodeId)!;

          const parentEdges = innerEdges.filter((e) => e.to === nodeId);
          const activeParentEdge = parentEdges[0]; // no branch routing in sub-chain
          const input = activeParentEdge
            ? innerOutputs[activeParentEdge.from]
            : item;

          const itemContext: ExpressionContext = {
            ...outerExpressionContext,
            nodes: { ...outerExpressionContext.nodes, ...innerOutputs },
            $item: { index: itemIndex, value: item },
          };

          return await this.nodeExecutor.execute(node, input, itemContext, executionContext);
        })
      );

      const firstFailure = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      if (firstFailure) {
        throw firstFailure.reason instanceof Error
          ? firstFailure.reason
          : new Error(String(firstFailure.reason));
      }

      for (let i = 0; i < group.length; i++) {
        const nodeId = group[i]!;
        innerOutputs[nodeId] = (results[i] as PromiseFulfilledResult<NodeOutput>).value;
      }
    }

    // Return the last node's output
    const lastGroup = groups[groups.length - 1] ?? [];
    const lastNodeId = lastGroup[lastGroup.length - 1];
    return lastNodeId !== undefined
      ? (innerOutputs[lastNodeId] ?? { data: null })
      : { data: null };
  }
}
