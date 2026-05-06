import { Router } from "express";
import { authorize } from "../../shared/middleware/authorize.js";
import type { ExecutionController } from "./ExecutionController.js";

export function createExecutionRouter(controller: ExecutionController): Router {
  const router = Router();

  router.get("/:id", authorize("execution:read"), controller.get);
  router.get("/:id/logs", authorize("execution:read"), controller.streamLogs);
  router.post("/:id/cancel", authorize("execution:cancel"), controller.cancel);

  return router;
}
