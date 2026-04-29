import { Router } from "express";
import type { QueueController } from "./QueueController.js";

export function createQueueRouter(controller: QueueController): Router {
  const router = Router();

  router.get("/dlq", controller.listDLQ);
  router.post("/dlq/:jobId/retry", controller.retryJob);
  router.delete("/dlq/:jobId", controller.discardJob);

  return router;
}
