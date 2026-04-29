export interface NodeDefinition {
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly configSchema?: Readonly<Record<string, unknown>>;
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
}

export interface INode {
  readonly definition: NodeDefinition;
  execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput>;
}
