import { Router } from "express";
import type { ApprovalController } from "./ApprovalController.js";

/**
 * Creates two routers:
 *   publicRouter  — POST approve/reject (no auth required — JWT in query param)
 *   privateRouter — GET status endpoints (requires authenticate + tenantContext)
 */
export function createApprovalRouters(controller: ApprovalController): {
  publicRouter: Router;
  privateRouter: Router;
} {
  const publicRouter  = Router();
  const privateRouter = Router();

  // ── Public: action endpoints ─────────────────────────────────────────────────
  publicRouter.post("/:id/approve", controller.approve);
  publicRouter.post("/:id/reject",  controller.reject);

  // ── Private: read endpoints ──────────────────────────────────────────────────
  privateRouter.get("/:id", controller.get);

  return { publicRouter, privateRouter };
}

/** Router for GET /api/executions/:id/approvals — mounted under execution router. */
export function createExecutionApprovalsRouter(controller: ApprovalController): Router {
  const router = Router({ mergeParams: true });
  router.get("/", controller.listByExecution);
  return router;
}
