import { Router } from "express";
import express from "express";
import { createRateLimit } from "../../shared/middleware/rateLimit.js";
import type { WebhookHandler } from "./WebhookHandler.js";

/**
 * Public router for incoming webhook calls: ALL /api/w/:webhookId
 * Mounted BEFORE express.json() so the raw body Buffer is preserved for HMAC.
 */
export function createIncomingWebhookRouter(handler: WebhookHandler): Router {
  const router = Router();

  const limiter = createRateLimit({ max: 200, windowMs: 60_000 });

  // Capture the raw body as a Buffer before any JSON parsing
  router.use(express.raw({ type: "*/*" }));

  router.all("/:webhookId", limiter, handler.handle);

  return router;
}
