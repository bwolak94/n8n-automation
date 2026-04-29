import type { NodeOutput } from "../nodes/contracts/INode.js";
import type { RetryConfig } from "./RetryManager.js";

export interface WorkflowNode {
  readonly id: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
  readonly retry?: RetryConfig;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
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
  readonly status: "running" | "completed" | "failed";
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: string;
}

export interface ExecutionResult {
  readonly executionId: string;
  readonly status: "completed" | "failed";
  readonly outputs: Record<string, NodeOutput>;
  readonly error?: Error;
}

export interface ExpressionContext {
  readonly nodes: Readonly<Record<string, NodeOutput>>;
  readonly variables: Readonly<Record<string, unknown>>;
  readonly trigger: Readonly<Record<string, unknown>>;
}

export interface IWorkflowRepository {
  findById(
    workflowId: string,
    tenantId: string
  ): Promise<WorkflowDefinition | null>;
}

export interface IExecutionLogRepository {
  create(log: Omit<ExecutionLog, "id">): Promise<ExecutionLog>;
  update(id: string, updates: Partial<Omit<ExecutionLog, "id">>): Promise<void>;
}
