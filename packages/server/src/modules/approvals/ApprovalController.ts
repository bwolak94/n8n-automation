import type { Request, Response, NextFunction } from "express";
import { ApprovalService, ApprovalExpiredError, ApprovalAlreadyDecidedError } from "./ApprovalService.js";
import { AppError } from "../../shared/errors/index.js";

export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  // POST /api/approvals/:id/approve  — public (JWT in query param)
  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token   = req.query["token"] as string | undefined;
      const comment = req.body?.comment as string | undefined;

      if (!token) {
        throw new AppError("Missing approval token", 400, "APPROVAL_MISSING_TOKEN");
      }

      const result = await this.approvalService.decide(req.params["id"]!, token, comment);
      res.json({
        approvalId:     req.params["id"],
        finalDecision:  result.finalDecision,
        executionId:    result.executionId,
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/approvals/:id/reject  — public (JWT in query param)
  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token   = req.query["token"] as string | undefined;
      const comment = req.body?.comment as string | undefined;

      if (!token) {
        throw new AppError("Missing approval token", 400, "APPROVAL_MISSING_TOKEN");
      }

      const result = await this.approvalService.decide(req.params["id"]!, token, comment);
      res.json({
        approvalId:    req.params["id"],
        finalDecision: result.finalDecision,
        executionId:   result.executionId,
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/approvals/:id  — authenticated
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId!;
      const approval = await this.approvalService.findById(req.params["id"]!, tenantId);
      res.json(approval);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/executions/:id/approvals  — authenticated
  listByExecution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId  = req.tenantId!;
      const approvals = await this.approvalService.findByExecutionId(req.params["id"]!, tenantId);
      res.json({ items: approvals });
    } catch (err) {
      next(err);
    }
  };
}

// Suppress unused import warnings (these errors are used in app-level error handler)
void ApprovalExpiredError;
void ApprovalAlreadyDecidedError;
