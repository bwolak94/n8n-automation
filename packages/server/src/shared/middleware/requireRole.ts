import type { NextFunction, Request, RequestHandler, Response } from "express";
import { TenantMemberRole } from "@automation-hub/shared";
import { ForbiddenError } from "../errors/index.js";

// ─── Role hierarchy ───────────────────────────────────────────────────────────
// Higher number = more permissions.

const ROLE_RANK: Record<TenantMemberRole, number> = {
  [TenantMemberRole.VIEWER]: 0,
  [TenantMemberRole.EDITOR]: 1,
  [TenantMemberRole.ADMIN]: 2,
  [TenantMemberRole.OWNER]: 3,
};

// ─── requireRole factory ──────────────────────────────────────────────────────
//
// Usage:
//   router.post("/", requireRole(TenantMemberRole.EDITOR), controller.create)
//
// Returns 403 ForbiddenError if the authenticated user's role is insufficient.

export function requireRole(minRole: TenantMemberRole): RequestHandler {
  return function roleGuard(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    const role = req.tenantRole;

    if (!role || ROLE_RANK[role] === undefined) {
      next(new ForbiddenError("No tenant role found on request"));
      return;
    }

    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      next(
        new ForbiddenError(
          `Requires '${minRole}' role or higher (current: '${role}')`
        )
      );
      return;
    }

    next();
  };
}
