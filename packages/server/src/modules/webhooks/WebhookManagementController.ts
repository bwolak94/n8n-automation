import type { NextFunction, Request, Response } from "express";
import { WebhookCreateSchema } from "@automation-hub/shared";
import { ValidationError } from "../../shared/errors/index.js";
import type { WebhookRepository } from "./WebhookRepository.js";
import { env } from "../../config/env.js";

function buildWebhookUrl(webhookId: string): string {
  return `${env.BASE_URL}/api/w/${webhookId}`;
}

export class WebhookManagementController {
  constructor(private readonly webhookRepo: WebhookRepository) {}

  // POST /api/webhooks/manage
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = WebhookCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }
      const record = await this.webhookRepo.create({
        tenantId: req.tenantId!,
        workflowId: parsed.data.workflowId,
        method: parsed.data.method,
        secret: parsed.data.secret,
      });
      res.status(201).json({
        id: record.id,
        url: buildWebhookUrl(record.webhookId),
        webhookId: record.webhookId,
        workflowId: record.workflowId,
        method: record.method,
        active: record.active,
        createdAt: record.createdAt,
      });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/webhooks/manage
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const records = await this.webhookRepo.findAllByTenant(req.tenantId!);
      const items = records.map((r) => ({
        id: r.id,
        url: buildWebhookUrl(r.webhookId),
        webhookId: r.webhookId,
        workflowId: r.workflowId,
        method: r.method,
        active: r.active,
        createdAt: r.createdAt,
      }));
      res.json({ items });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/webhooks/manage/:id
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.webhookRepo.delete(req.params["id"]!, req.tenantId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
