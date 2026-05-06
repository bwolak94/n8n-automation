import type { NextFunction, Request, Response } from "express";
import { TenantMemberModel } from "../../modules/tenants/TenantMember.model.js";
import { UnauthorizedError } from "../errors/index.js";

export async function tenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const tenantId = req.headers["x-tenant-id"];
    if (typeof tenantId !== "string" || tenantId.length === 0) {
      next(new UnauthorizedError("Missing X-Tenant-Id header"));
      return;
    }

    const member = await TenantMemberModel.findOne({
      tenantId,
      userId: req.user.userId,
    }).lean();

    if (!member) {
      next(new UnauthorizedError("Not a member of this tenant"));
      return;
    }

    req.tenantId = tenantId;
    req.tenantRole = member.role;
    req.tenantCustomPermissions = (member as { customPermissions?: string[] }).customPermissions ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
}
