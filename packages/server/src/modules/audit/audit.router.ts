import { Router } from "express";
import type { AuditLogController } from "./AuditLogController.js";

export function createAuditRouter(controller: AuditLogController): Router {
  const router = Router();
  // /export must be registered before /:id-style routes to avoid conflicts
  router.get("/export", controller.export);
  router.get("/", controller.list);
  return router;
}
