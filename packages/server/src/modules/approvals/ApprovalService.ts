import jwt from "jsonwebtoken";
import type { ApprovalRepository, Approval, ApprovalDecision } from "./ApprovalRepository.js";
import type { ApprovalNodeConfig } from "@automation-hub/shared";
import { AppError } from "../../shared/errors/index.js";
import type { IResumableQueue } from "../../engine/WorkflowRunner.js";
import { env } from "../../config/env.js";

// ─── Token payload ────────────────────────────────────────────────────────────

interface ApprovalTokenPayload {
  approvalId: string;
  decision: "approved" | "rejected";
  reviewer: string;
  type: "approval";
  iat?: number;
  exp?: number;
}

// ─── Notifier interface ───────────────────────────────────────────────────────

export interface IApprovalNotifier {
  notify(params: {
    to: string;
    approveUrl: string;
    rejectUrl: string;
    message: string;
    workflowName?: string;
    timeoutHours: number;
  }): Promise<void>;
}

// ─── Public interface (used by ApprovalNode) ──────────────────────────────────

export interface IApprovalCreator {
  createApproval(params: CreateApprovalParams): Promise<{ id: string }>;
}

// ─── Parameter / return types ─────────────────────────────────────────────────

export interface CreateApprovalParams {
  executionId: string;
  nodeId: string;
  tenantId: string;
  config: ApprovalNodeConfig;
  workflowName?: string;
}

export interface DecideResult {
  executionId: string;
  tenantId: string;
  /** 'pending' means AND mode is active and we still need more approvals. */
  finalDecision: "approved" | "rejected" | "pending";
}

// ─── Domain errors ────────────────────────────────────────────────────────────

export class ApprovalExpiredError extends AppError {
  constructor() {
    super("This approval link has expired", 410, "APPROVAL_EXPIRED");
  }
}

export class ApprovalAlreadyDecidedError extends AppError {
  constructor() {
    super("A decision has already been made on this approval", 409, "APPROVAL_ALREADY_DECIDED");
  }
}

// ─── ApprovalService ──────────────────────────────────────────────────────────

export class ApprovalService implements IApprovalCreator {
  constructor(
    private readonly repo: ApprovalRepository,
    private readonly queue?: IResumableQueue,
    private readonly notifier?: IApprovalNotifier
  ) {}

  // ── createApproval ────────────────────────────────────────────────────────────

  async createApproval(params: CreateApprovalParams): Promise<{ id: string }> {
    const { executionId, nodeId, tenantId, config, workflowName } = params;

    const expiresAt = new Date(Date.now() + config.timeoutHours * 3_600_000);

    const approval = await this.repo.create({
      executionId,
      nodeId,
      tenantId,
      reviewers: config.reviewers,
      requireAll: config.requireAll,
      timeoutAction: config.timeoutAction,
      expiresAt,
    });

    // Send notification to each reviewer (failures are fire-and-forget)
    await Promise.allSettled(
      config.reviewers.map((reviewer) => {
        const approveToken = this.signToken(approval.id, "approved", reviewer, config.timeoutHours);
        const rejectToken  = this.signToken(approval.id, "rejected", reviewer, config.timeoutHours);

        const approveUrl = `${env.BASE_URL}/approval/${approval.id}?token=${approveToken}`;
        const rejectUrl  = `${env.BASE_URL}/approval/${approval.id}?token=${rejectToken}`;

        return this.notifier?.notify({
          to:           reviewer,
          approveUrl,
          rejectUrl,
          message:      config.message ?? "A workflow is awaiting your approval.",
          workflowName,
          timeoutHours: config.timeoutHours,
        });
      })
    );

    return { id: approval.id };
  }

  // ── decide ────────────────────────────────────────────────────────────────────

  async decide(approvalId: string, tokenStr: string, comment?: string): Promise<DecideResult> {
    const approval = await this.repo.findById(approvalId);
    if (!approval) {
      throw new AppError("Approval not found", 404, "APPROVAL_NOT_FOUND");
    }

    // Validate JWT
    const payload = this.verifyToken(tokenStr, approvalId);

    // Check expiry
    if (new Date() > approval.expiresAt) {
      throw new ApprovalExpiredError();
    }

    // Check already finally decided (not pending)
    if (approval.status !== "pending") {
      throw new ApprovalAlreadyDecidedError();
    }

    // In AND mode, prevent the same reviewer from voting twice
    if (approval.requireAll) {
      const alreadyVoted = approval.decisions.some((d) => d.reviewer === payload.reviewer);
      if (alreadyVoted) throw new ApprovalAlreadyDecidedError();
    }

    const newDecision: ApprovalDecision = {
      reviewer:  payload.reviewer,
      decision:  payload.decision,
      comment,
      decidedAt: new Date().toISOString(),
    };

    const allDecisions = [...approval.decisions, newDecision];
    const finalDecision = this.computeFinalDecision(allDecisions, approval.reviewers, payload.decision, approval.requireAll);

    // Always persist new decision entry
    await this.repo.update(approvalId, { decisions: allDecisions });

    if (finalDecision === "pending") {
      return { executionId: approval.executionId, tenantId: approval.tenantId, finalDecision };
    }

    // Final decision reached
    await this.repo.update(approvalId, {
      status:     finalDecision,
      decisionBy: payload.reviewer,
      comment,
      decidedAt:  new Date(),
    });

    await this.applyDecision(approval, finalDecision, payload.reviewer, comment);

    return { executionId: approval.executionId, tenantId: approval.tenantId, finalDecision };
  }

  // ── expireApproval ────────────────────────────────────────────────────────────

  async expireApproval(approvalId: string): Promise<void> {
    const approval = await this.repo.findById(approvalId);
    if (!approval || approval.status !== "pending") return;

    const finalDecision: "approved" | "rejected" = approval.timeoutAction === "approve"
      ? "approved"
      : "rejected";

    await this.repo.update(approvalId, { status: "expired", decidedAt: new Date() });
    await this.applyDecision(approval, finalDecision, "timeout", "Approval expired without a decision");
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<Approval> {
    const approval = await this.repo.findById(id, tenantId);
    if (!approval) throw new AppError("Approval not found", 404, "APPROVAL_NOT_FOUND");
    return approval;
  }

  async findByExecutionId(executionId: string, tenantId: string): Promise<Approval[]> {
    return this.repo.findByExecutionId(executionId, tenantId);
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async applyDecision(
    approval: Approval,
    finalDecision: "approved" | "rejected",
    decisionBy: string,
    comment?: string
  ): Promise<void> {
    // Patch the approval node's output in the suspended execution state so branch routing works.
    // _branch: 0 = approved (true branch), _branch: 1 = rejected (false branch)
    await this.repo.patchSuspendedNodeOutput(approval.executionId, approval.nodeId, {
      data: {
        approved:   finalDecision === "approved",
        decisionBy,
        comment:    comment ?? null,
        _branch:    finalDecision === "approved" ? 0 : 1,
      },
    });

    // Enqueue immediate resume (delayMs = 0)
    await this.queue?.enqueueResume(approval.executionId, approval.tenantId, 0);
  }

  private signToken(
    approvalId: string,
    decision: "approved" | "rejected",
    reviewer: string,
    timeoutHours: number
  ): string {
    const payload: Omit<ApprovalTokenPayload, "iat" | "exp"> = {
      approvalId,
      decision,
      reviewer,
      type: "approval",
    };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${timeoutHours}h` as string });
  }

  private verifyToken(tokenStr: string, approvalId: string): ApprovalTokenPayload {
    try {
      const payload = jwt.verify(tokenStr, env.JWT_SECRET) as ApprovalTokenPayload;
      if (payload.type !== "approval") {
        throw new AppError("Invalid approval token", 401, "APPROVAL_INVALID_TOKEN");
      }
      if (payload.approvalId !== approvalId) {
        throw new AppError("Token does not match approval ID", 401, "APPROVAL_TOKEN_MISMATCH");
      }
      return payload;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const name = (err as { name?: string }).name;
      if (name === "TokenExpiredError") throw new ApprovalExpiredError();
      throw new AppError("Invalid approval token", 401, "APPROVAL_INVALID_TOKEN");
    }
  }

  private computeFinalDecision(
    decisions: ApprovalDecision[],
    reviewers: string[],
    latestDecision: "approved" | "rejected",
    requireAll: boolean
  ): "approved" | "rejected" | "pending" {
    // Any rejection always immediately rejects (in both AND/OR modes)
    if (latestDecision === "rejected") return "rejected";

    if (!requireAll) {
      // OR mode: first approval wins
      return "approved";
    }

    // AND mode: all reviewers must have approved
    const approvedSet = new Set(
      decisions.filter((d) => d.decision === "approved").map((d) => d.reviewer)
    );
    const allApproved = reviewers.every((r) => approvedSet.has(r));
    return allApproved ? "approved" : "pending";
  }
}
