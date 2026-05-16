import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError } from "../errors/index.js";
import { hasPermission, type Permission } from "../../modules/auth/permissions.js";

/**
 * Permission-based authorization middleware.
 *
 * Usage:
 *   router.post("/", authorize("workflow:create"), controller.create)
 *
 * Resolution order (see hasPermission):
 *   1. Owner always passes.
 *   2. Member-level customPermissions override the role if non-empty.
 *   3. Otherwise the built-in ROLE_PERMISSIONS map is used.
 */
export function authorize(permission: Permission): RequestHandler {
  return function permissionGuard(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    const role = req.tenantRole;

    if (!role) {
      next(new ForbiddenError("No tenant role found on request"));
      return;
    }

    if (!hasPermission(role, req.tenantCustomPermissions, permission)) {
      next(
        new ForbiddenError(
          `Permission '${permission}' is required for this action`
        )
      );
      return;
    }

    next();
  };
}
