export interface NodeDefinition {
  readonly type: string;
  readonly name: string;
  readonly description?: string;
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
}

export interface INode {
  readonly definition: NodeDefinition;
  execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput>;
}
