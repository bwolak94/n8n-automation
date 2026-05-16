import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { TenantMemberRole } from "@automation-hub/shared";
import { ValidationError } from "../../shared/errors/index.js";
import type { TenantService } from "./TenantService.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

const InviteBodySchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(TenantMemberRole).default(TenantMemberRole.EDITOR),
});

const UpdateRoleBodySchema = z.object({
  role: z.nativeEnum(TenantMemberRole),
});

const ClaimBodySchema = z.object({
  token: z.string().min(1),
});

// ─── TenantController ─────────────────────────────────────────────────────────

export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  // GET /api/tenants/me
  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.tenantService.getTenantWithMembers(req.tenantId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/tenants/members/invite
  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = InviteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }

      const token = await this.tenantService.inviteMember(
        req.tenantId!,
        req.tenantRole!,
        parsed.data.email,
        parsed.data.role
      );

      res.status(201).json({ inviteToken: token });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/tenants/members/claim
  claimInvite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ClaimBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError("Missing invite token"));
        return;
      }

      const member = await this.tenantService.claimInvite(parsed.data.token);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/tenants/members/:userId/role
  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UpdateRoleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid role"));
        return;
      }

      await this.tenantService.updateMemberRole(
        req.tenantId!,
        req.tenantRole!,
        req.params["userId"]!,
        parsed.data.role
      );

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/tenants/members/:userId
  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.tenantService.removeMember(
        req.tenantId!,
        req.tenantRole!,
        req.params["userId"]!
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
