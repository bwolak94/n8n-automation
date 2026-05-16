import { Router } from "express";
import { TenantMemberRole } from "@automation-hub/shared";
import { requireRole } from "../../shared/middleware/requireRole.js";
import type { TenantController } from "./TenantController.js";

export function createTenantRouter(controller: TenantController): Router {
  const router = Router();

  // GET /api/tenants/me — any authenticated member can view their org
  router.get("/me", controller.getMe);

  // POST /api/tenants/members/invite — admin+ only
  router.post(
    "/members/invite",
    requireRole(TenantMemberRole.ADMIN),
    controller.invite
  );

  // POST /api/tenants/members/claim — public-ish: requester has invite token
  // Still requires auth so we know who is claiming
  router.post("/members/claim", controller.claimInvite);

  // PATCH /api/tenants/members/:userId/role — admin+ only
  router.patch(
    "/members/:userId/role",
    requireRole(TenantMemberRole.ADMIN),
    controller.updateRole
  );

  // DELETE /api/tenants/members/:userId — admin+ only
  router.delete(
    "/members/:userId",
    requireRole(TenantMemberRole.ADMIN),
    controller.removeMember
  );

  return router;
}
