import { ForbiddenError } from "../../shared/errors/index.js";
import {
  SubWorkflowDepthError,
  MAX_SUB_WORKFLOW_DEPTH,
} from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { ExecutionResult, IWorkflowRepository } from "../../engine/types.js";

// ─── ISubWorkflowRunner ────────────────────────────────────────────────────────

/**
 * Minimal interface SubWorkflowNode depends on.
 * WorkflowRunner satisfies this interface — the indirection breaks the
 * circular dependency: SubWorkflowNode → ISubWorkflowRunner ← WorkflowRunner.
 */
export interface ISubWorkflowRunner {
  run(
    workflowId: string,
    tenantId: string,
    triggerData: Record<string, unknown>,
    opts?: { depth?: number; parentExecutionId?: string }
  ): Promise<ExecutionResult>;
}

// ─── SubWorkflowNode ──────────────────────────────────────────────────────────

export class SubWorkflowNode implements INode {
  readonly definition: NodeDefinition = {
    type: "sub_workflow",
    name: "Sub-workflow",
    description:
      "Invoke another workflow as a reusable step and receive its output",
    configSchema: {
      type: "object",
      required: ["subWorkflowId"],
      properties: {
        subWorkflowId: { type: "string", description: "ID of the workflow to invoke" },
        inputMapping:  { type: "object", description: "Map of field name → value/expression" },
        waitForResult: { type: "boolean", default: true },
        timeout:       { type: "number", default: 30000, description: "Timeout in ms" },
      },
    },
  };

  constructor(
    private readonly runner: ISubWorkflowRunner,
    private readonly workflowRepo: IWorkflowRepository
  ) {}

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const subWorkflowId = config["subWorkflowId"] as string;
    const inputMapping  = (config["inputMapping"] as Record<string, unknown> | undefined) ?? {};
    const waitForResult = (config["waitForResult"] as boolean | undefined) ?? true;
    const timeout       = (config["timeout"] as number | undefined) ?? 30_000;

    // ── Depth guard ───────────────────────────────────────────────────────────
    const currentDepth = context.depth ?? 0;
    if (currentDepth >= MAX_SUB_WORKFLOW_DEPTH) {
      throw new SubWorkflowDepthError(currentDepth);
    }

    // ── Tenant isolation ──────────────────────────────────────────────────────
    const subWorkflow = await this.workflowRepo.findById(subWorkflowId, context.tenantId);
    if (!subWorkflow) {
      throw new ForbiddenError(
        `Sub-workflow '${subWorkflowId}' not found or belongs to a different tenant`
      );
    }

    // ── Build trigger data ────────────────────────────────────────────────────
    // inputMapping values are already expression-resolved by NodeExecutor before
    // execute() is called, so we can use them directly as the trigger payload.
    const triggerData: Record<string, unknown> = {
      ...(typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}),
      ...inputMapping,
    };

    // ── Async fire-and-forget ─────────────────────────────────────────────────
    if (!waitForResult) {
      // Kick off without awaiting; errors are swallowed intentionally.
      void this.runner.run(subWorkflowId, context.tenantId, triggerData, {
        depth: currentDepth + 1,
        parentExecutionId: context.executionId,
      });
      return { data: { fired: true, subWorkflowId } };
    }

    // ── Synchronous execution with timeout ───────────────────────────────────
    const runPromise = this.runner.run(subWorkflowId, context.tenantId, triggerData, {
      depth: currentDepth + 1,
      parentExecutionId: context.executionId,
    });

    let result: ExecutionResult;
    if (timeout > 0) {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Sub-workflow timed out after ${timeout}ms`)), timeout)
      );
      result = await Promise.race([runPromise, timeoutPromise]);
    } else {
      result = await runPromise;
    }

    if (result.status === "failed") {
      throw result.error ?? new Error("Sub-workflow execution failed");
    }

    // Return the last node's output from the sub-workflow
    const outputValues = Object.values(result.outputs);
    const lastOutput = outputValues[outputValues.length - 1];
    return lastOutput ?? { data: null };
  }
}
