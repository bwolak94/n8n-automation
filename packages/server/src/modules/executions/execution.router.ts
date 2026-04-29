import { Router } from "express";
import type { ExecutionController } from "./ExecutionController.js";

export function createExecutionRouter(controller: ExecutionController): Router {
  const router = Router();

  router.get("/:id", controller.get);
  router.get("/:id/logs", controller.streamLogs);
  router.post("/:id/cancel", controller.cancel);

  return router;
}
