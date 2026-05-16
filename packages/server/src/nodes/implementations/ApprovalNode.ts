import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import { makeSuspendOutput } from "../../engine/SuspendSignal.js";
import { ApprovalNodeConfigSchema } from "@automation-hub/shared";
import type { IApprovalCreator } from "../../modules/approvals/ApprovalService.js";

export class ApprovalNode implements INode {
  readonly definition: NodeDefinition = {
    type: "human_approval",
    name: "Human Approval",
    description:
      "Pause workflow and wait for a human to approve or reject before proceeding. " +
      "Sends an email or Slack notification to reviewers with signed action links.",
  };

  constructor(private readonly approvalCreator?: IApprovalCreator) {}

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const parsed = ApprovalNodeConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new AppError(
        `ApprovalNode config invalid: ${parsed.error.errors[0]?.message ?? "unknown"}`,
        400,
        "APPROVAL_INVALID_CONFIG"
      );
    }

    if (!this.approvalCreator) {
      throw new AppError(
        "ApprovalNode requires an ApprovalService to be configured",
        500,
        "APPROVAL_NO_SERVICE"
      );
    }

    const cfg = parsed.data;
    const { executionId, tenantId } = context;
    const nodeId = context.nodeId ?? "unknown";

    // Create the approval record and dispatch notifications
    const { id: approvalId } = await this.approvalCreator.createApproval({
      executionId,
      nodeId,
      tenantId,
      config: cfg,
    });

    const delayMs     = cfg.timeoutHours * 3_600_000;
    const resumeAfter = new Date(Date.now() + delayMs).toISOString();

    // Suspend execution — the timeout job will auto-reject/approve after delayMs.
    // A human decision calls ApprovalService.decide() → patchSuspendedNodeOutput + enqueueResume.
    return makeSuspendOutput(
      { approvalId, status: "pending", reviewers: cfg.reviewers },
      { delayMs, resumeAfter, mode: "webhook" }
    );
  }
}
