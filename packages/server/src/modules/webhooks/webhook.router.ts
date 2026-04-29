import { Router } from "express";
import type { RequestHandler } from "express";
import { createRateLimit } from "../../shared/middleware/rateLimit.js";
import type { WebhookController } from "./WebhookController.js";

export interface WebhookRouterOptions {
  rateLimit?: { max: number; windowMs: number };
}

export function createWebhookRouter(
  controller: WebhookController,
  options: WebhookRouterOptions = {}
): Router {
  const router = Router();
  const limiter: RequestHandler = createRateLimit(
    options.rateLimit ?? { max: 100, windowMs: 60_000 }
  );

  router.post("/:workflowId/:path", limiter, controller.trigger);

  return router;
}
