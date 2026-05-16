import { Router } from "express";
import type { WebhookManagementController } from "./WebhookManagementController.js";

/**
 * Authenticated router for managing webhook registrations.
 * Mounted at /api/webhooks (after authenticate + tenantContext middleware).
 */
export function createWebhookManagementRouter(
  controller: WebhookManagementController
): Router {
  const router = Router();

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.delete("/:id", controller.remove);

  return router;
}
