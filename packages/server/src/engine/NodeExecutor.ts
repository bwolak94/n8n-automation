import type { ExecutionContext, NodeOutput } from "../nodes/contracts/INode.js";
import type { NodeRegistry } from "../nodes/NodeRegistry.js";
import type { EventBus } from "./EventBus.js";
import type { RetryManager } from "./RetryManager.js";
import type { ExpressionEvaluator } from "./ExpressionEvaluator.js";
import type { ExpressionContext, WorkflowNode } from "./types.js";
import { type RetryConfig } from "./RetryManager.js";

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 1,
  backoffStrategy: "fixed",
  backoffDelay: 0,
};

export class NodeExecutor {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly evaluator: ExpressionEvaluator,
    private readonly retryManager: RetryManager,
    private readonly eventBus: EventBus
  ) {}

  async execute(
    node: WorkflowNode,
    input: unknown,
    expressionContext: ExpressionContext,
    executionContext: ExecutionContext
  ): Promise<NodeOutput> {
    const resolvedNode = this.registry.resolve(node.type);
    const resolvedConfig = this.evaluator.evaluateConfig(
      node.config,
      expressionContext
    );
    const retryConfig = node.retry ?? DEFAULT_RETRY_CONFIG;

    const jobContext = {
      nodeId: node.id,
      executionId: executionContext.executionId,
      tenantId: executionContext.tenantId,
      payload: input,
    };

    await this.eventBus.emit("step.started", {
      executionId: executionContext.executionId,
      workflowId: executionContext.workflowId,
      tenantId: executionContext.tenantId,
      nodeId: node.id,
      nodeType: node.type,
      startedAt: new Date(),
    });

    try {
      const output = await this.retryManager.execute(
        () =>
          resolvedNode.execute(input, resolvedConfig, {
            ...executionContext,
            signal: executionContext.signal,
          }),
        retryConfig,
        jobContext
      );

      await this.eventBus.emit("step.completed", {
        executionId: executionContext.executionId,
        workflowId: executionContext.workflowId,
        tenantId: executionContext.tenantId,
        nodeId: node.id,
        nodeType: node.type,
        completedAt: new Date(),
        output,
      });

      return output;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      await this.eventBus.emit("step.failed", {
        executionId: executionContext.executionId,
        workflowId: executionContext.workflowId,
        tenantId: executionContext.tenantId,
        nodeId: node.id,
        nodeType: node.type,
        failedAt: new Date(),
        error,
      });

      throw error;
    }
  }
}
