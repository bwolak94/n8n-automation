import type { NextFunction, Request, RequestHandler, Response } from "express";
import { TenantModel, PLAN_LIMITS } from "../../modules/tenants/Tenant.model.js";
import { PlanLimitError, UnauthorizedError } from "../errors/index.js";

// ─── Resource types ───────────────────────────────────────────────────────────

export type PlanResource = "workflows" | "executions" | "aiTokens" | "members";

// ─── planGuard factory ────────────────────────────────────────────────────────
//
// Reads `Tenant.usageThisMonth` (NOT the execution log) for O(1) checks.
// Returns 402 PlanLimitError if the resource limit is exceeded.
//
// Usage:
//   router.post("/", planGuard("workflows"), controller.create)

export function planGuard(resource: PlanResource): RequestHandler {
  return async function checkPlanLimit(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        next(new UnauthorizedError("Tenant context missing"));
        return;
      }

      const tenant = await (TenantModel.findOne({ tenantId }) as unknown as {
        lean(): Promise<{
          plan: string;
          usageThisMonth: { workflows: number; executions: number; aiTokens: number; members: number };
        } | null>;
      }).lean();

      if (!tenant) {
        next(new UnauthorizedError("Tenant not found"));
        return;
      }

      const limits = PLAN_LIMITS[tenant.plan];
      if (!limits) {
        // Unknown plan — allow (graceful degradation)
        next();
        return;
      }

      const usage = tenant.usageThisMonth;

      switch (resource) {
        case "workflows":
          if (limits.workflows !== Infinity && usage.workflows >= limits.workflows) {
            next(
              new PlanLimitError(
                `Workflow limit (${limits.workflows}) reached for '${tenant.plan}' plan`
              )
            );
            return;
          }
          break;

        case "executions":
          if (
            limits.executionsPerMonth !== Infinity &&
            usage.executions >= limits.executionsPerMonth
          ) {
            next(
              new PlanLimitError(
                `Execution limit (${limits.executionsPerMonth}/month) reached for '${tenant.plan}' plan`
              )
            );
            return;
          }
          break;

        case "aiTokens":
          if (
            limits.aiTokensPerMonth !== Infinity &&
            usage.aiTokens >= limits.aiTokensPerMonth
          ) {
            next(
              new PlanLimitError(
                `AI token limit (${limits.aiTokensPerMonth}/month) reached for '${tenant.plan}' plan`
              )
            );
            return;
          }
          break;

        case "members":
          if (limits.members !== Infinity && usage.members >= limits.members) {
            next(
              new PlanLimitError(
                `Member limit (${limits.members}) reached for '${tenant.plan}' plan`
              )
            );
            return;
          }
          break;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
