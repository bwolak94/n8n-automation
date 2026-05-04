export interface NodeDefinition {
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly configSchema?: Readonly<Record<string, unknown>>;
  /** When true, this node is a trigger — the engine does not call execute() on it. */
  readonly trigger?: boolean;
}

export interface NodeOutput {
  readonly data: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionContext {
  readonly tenantId: string;
  readonly executionId: string;
  readonly workflowId: string;
  readonly signal?: AbortSignal;
  readonly variables: Record<string, unknown>;
  /** The ID of the node currently being executed — injected by NodeExecutor. */
  readonly nodeId?: string;
  /** Current sub-workflow recursion depth (0 = top-level). */
  readonly depth?: number;
  /** Execution ID of the parent workflow that invoked this one. */
  readonly parentExecutionId?: string;
}

export interface INode {
  readonly definition: NodeDefinition;
  execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput>;
}
