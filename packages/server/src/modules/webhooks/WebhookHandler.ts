import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../shared/errors/index.js";
import type { WebhookRepository } from "./WebhookRepository.js";
import type { IEnqueueable } from "../workflows/WorkflowService.js";

/**
 * Constant-time HMAC-SHA256 signature verification.
 * Returns false when lengths differ (avoids timing info leak on short-circuit).
 */
function verifyHmacSignature(secret: string, rawBody: Buffer, signatureHeader: string): boolean {
  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

export class WebhookHandler {
  constructor(
    private readonly webhookRepo: WebhookRepository,
    private readonly queue: IEnqueueable | null
  ) {}

  /**
   * Handles ALL /api/w/:webhookId requests.
   * The router should use express.raw({ type: '*‌/*' }) before this handler
   * so that req.body is a raw Buffer for HMAC verification.
   */
  handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { webhookId } = req.params as { webhookId: string };

      // 1. Look up webhook record
      const record = await this.webhookRepo.findByWebhookId(webhookId);
      if (!record || !record.active) {
        next(new NotFoundError("Webhook not found"));
        return;
      }

      // 2. Validate HTTP method (unless webhook accepts ANY)
      if (record.method !== "ANY" && req.method !== record.method) {
        next(new NotFoundError("Method not allowed for this webhook"));
        return;
      }

      const rawBody = req.body as Buffer;

      // 3. Verify HMAC signature when a secret is configured
      if (record.secret) {
        const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
        if (!signatureHeader) {
          next(new UnauthorizedError("Missing X-Hub-Signature-256 header"));
          return;
        }
        if (!verifyHmacSignature(record.secret, rawBody, signatureHeader)) {
          next(new UnauthorizedError("Invalid HMAC signature"));
          return;
        }
      }

      // 4. Parse body (JSON if content-type indicates it, otherwise keep as string)
      let parsedBody: unknown = rawBody.length > 0 ? rawBody.toString("utf8") : null;
      const contentType = req.headers["content-type"] ?? "";
      if (contentType.includes("application/json") && rawBody.length > 0) {
        try {
          parsedBody = JSON.parse(rawBody.toString("utf8")) as unknown;
        } catch {
          // keep as raw string
        }
      }

      // 5. Build trigger data
      const triggerData = {
        body: parsedBody,
        headers: req.headers,
        query: req.query,
        method: req.method,
        webhookId,
      };

      // 6. Enqueue workflow execution
      if (this.queue) {
        await this.queue.enqueue(record.workflowId, triggerData, record.tenantId);
      }

      res.status(202).json({ accepted: true, workflowId: record.workflowId });
    } catch (err) {
      next(err);
    }
  };
}

// Export for unit testing
export { verifyHmacSignature };
