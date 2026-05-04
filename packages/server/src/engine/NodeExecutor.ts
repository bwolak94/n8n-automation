import type { ExecutionContext, INode, NodeOutput } from "../nodes/contracts/INode.js";
import type { NodeRegistry } from "../nodes/NodeRegistry.js";
import type { EventBus } from "./EventBus.js";
import type { RetryManager } from "./RetryManager.js";
import type { ExpressionEvaluator } from "./ExpressionEvaluator.js";
import type { ExpressionContext, WorkflowNode } from "./types.js";
import { type RetryConfig } from "./RetryManager.js";
import type { CredentialService } from "../modules/credentials/CredentialService.js";

/** Extracts all $credentials.NAME references from a serialised config string. */
function extractCredentialNames(config: Record<string, unknown>): string[] {
  const json = JSON.stringify(config);
  const matches = json.matchAll(/\$credentials\.([a-zA-Z0-9_-]+)/g);
  return [...new Set([...matches].map((m) => m[1]!))];
}

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
    private readonly eventBus: EventBus,
    private readonly credentialService?: CredentialService
  ) {}

  async execute(
    node: WorkflowNode,
    input: unknown,
    expressionContext: ExpressionContext,
    executionContext: ExecutionContext
  ): Promise<NodeOutput> {
    const resolvedNode =
      "resolveForTenant" in this.registry
        ? (this.registry as unknown as { resolveForTenant(t: string, id: string): INode }).resolveForTenant(node.type, executionContext.tenantId)
        : this.registry.resolve(node.type);

    // Resolve $credentials references before evaluating the config
    let enrichedContext = expressionContext;
    if (this.credentialService) {
      const credNames = extractCredentialNames(node.config);
      if (credNames.length > 0) {
        const credentials = await this.credentialService.resolveForExecution(
          executionContext.tenantId,
          credNames
        );
        enrichedContext = { ...expressionContext, credentials };
      }
    }

    const resolvedConfig = this.evaluator.evaluateConfig(
      node.config,
      enrichedContext
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
            nodeId: node.id,
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
