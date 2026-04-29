import { NotFoundError } from "../shared/errors/index.js";
import type { ExecutionContext, NodeOutput } from "../nodes/contracts/INode.js";
import type { NodeExecutor } from "./NodeExecutor.js";
import type { TopologicalSorter } from "./TopologicalSorter.js";
import type { EventBus } from "./EventBus.js";
import type {
  ExpressionContext,
  ExecutionResult,
  IWorkflowRepository,
  IExecutionLogRepository,
} from "./types.js";

export class WorkflowRunner {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionLogRepo: IExecutionLogRepository,
    private readonly nodeExecutor: NodeExecutor,
    private readonly sorter: TopologicalSorter,
    private readonly eventBus: EventBus
  ) {}

  async run(
    workflowId: string,
    tenantId: string,
    triggerData: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const workflow = await this.workflowRepo.findById(workflowId, tenantId);
    if (!workflow) {
      throw new NotFoundError(`Workflow '${workflowId}' not found`);
    }

    const log = await this.executionLogRepo.create({
      workflowId,
      tenantId,
      status: "running",
      startedAt: new Date(),
    });

    const executionContext: ExecutionContext = {
      tenantId,
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

    const outputs: Record<string, NodeOutput> = {};

    try {
      const nodeIds = workflow.nodes.map((n) => n.id);
      const groups = this.sorter.sort(nodeIds, workflow.edges);

      for (const group of groups) {
        const results = await Promise.allSettled(
          group.map((nodeId) => {
            const node = workflow.nodes.find((n) => n.id === nodeId)!;

            const expressionContext: ExpressionContext = {
              nodes: outputs,
              variables: executionContext.variables,
              trigger: triggerData,
            };

            // Use the last parent's output as input; fall back to trigger data
            const parentEdges = workflow.edges.filter((e) => e.to === nodeId);
            const input =
              parentEdges.length > 0
                ? outputs[parentEdges[parentEdges.length - 1].from]
                : triggerData;

            return this.nodeExecutor.execute(
              node,
              input,
              expressionContext,
              executionContext
            );
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
          const result = results[i] as PromiseFulfilledResult<NodeOutput>;
          outputs[group[i]] = result.value;
        }
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
        outputs,
      });

      return { executionId: log.id, status: "completed", outputs };
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
}
