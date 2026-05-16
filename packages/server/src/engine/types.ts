import type { NodeOutput } from "../nodes/contracts/INode.js";
import type { RetryConfig } from "./RetryManager.js";

export interface WorkflowNode {
  readonly id: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
  readonly retry?: RetryConfig;
  /** ID of the LoopNode that owns this node (marks it as a loop-scoped inner node). */
  readonly loopNodeId?: string;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  /** Port index on the source node (e.g. "0" = true branch, "1" = false branch). */
  readonly sourceHandle?: string;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly tenantId: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly variables?: Readonly<Record<string, unknown>>;
}

export interface ExecutionLog {
  readonly id: string;
  readonly workflowId: string;
  readonly tenantId: string;
  readonly status: "running" | "completed" | "failed" | "waiting";
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: string;
  /** Set when this execution was triggered by a sub-workflow node in a parent execution. */
  readonly parentExecutionId?: string;
}

export interface ExecutionResult {
  readonly executionId: string;
  readonly status: "completed" | "failed" | "waiting";
  readonly outputs: Record<string, NodeOutput>;
  readonly error?: Error;
}

/**
 * Serialised execution state saved to PostgreSQL when a WaitNode suspends execution.
 * Loaded by WorkflowRunner.resume() to continue from where it left off.
 */
export interface SuspendedExecutionState {
  readonly workflowId: string;
  readonly triggerData: Record<string, unknown>;
  /** Serialised NodeOutput values (data + optional metadata) keyed by nodeId. */
  readonly outputs: Record<string, { data: unknown; metadata?: Record<string, unknown> }>;
  /** Remaining topological groups (nodeId arrays) that have not yet executed. */
  readonly remainingGroups: string[][];
  /** Serialised activeBranches map entries: [nodeId, branchIndex][]. */
  readonly activeBranches: [string, number][];
  /** NodeIds that were pruned by branch logic. */
  readonly skippedNodes: string[];
}

export interface ExpressionContext {
  readonly nodes: Readonly<Record<string, NodeOutput>>;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly trigger: Readonly<Record<string, unknown>>;
  readonly credentials?: Readonly<Record<string, Record<string, string>>>;
  /** Set by WorkflowRunner when executing inside a loop body. */
  readonly $item?: Readonly<{ index: number; value: unknown }>;
}

export interface IWorkflowRepository {
  findById(
    workflowId: string,
    tenantId: string
  ): Promise<WorkflowDefinition | null>;
}

export interface ExecutionStep {
  readonly id: string;
  readonly executionId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly status: "running" | "completed" | "failed";
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
}

export interface IExecutionLogRepository {
  create(log: Omit<ExecutionLog, "id">): Promise<ExecutionLog>;
  update(id: string, updates: Partial<Omit<ExecutionLog, "id">>): Promise<void>;
  createStep(step: Omit<ExecutionStep, "id">): Promise<ExecutionStep>;
  updateStep(id: string, updates: Partial<Omit<ExecutionStep, "id">>): Promise<void>;
  /** Persist suspension state — called by WorkflowRunner when a WaitNode fires. */
  suspend?(id: string, resumeAfter: Date, resumeData: SuspendedExecutionState): Promise<void>;
  /** Load suspended state for resume — returns null if not found or not in 'waiting' status. */
  loadSuspendedState?(id: string, tenantId: string): Promise<SuspendedExecutionState | null>;
}
