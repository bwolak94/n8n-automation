import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/index.js";
import type { TemplateService } from "./TemplateService.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  search:   z.string().optional(),
  category: z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

const PublishBodySchema = z.object({
  workflowId: z.string().min(1),
  category:   z.string().min(1),
  tags:       z.array(z.string()).optional(),
  isPublic:   z.boolean().optional(),
});

// ─── TemplateController ───────────────────────────────────────────────────────

export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  // GET /api/templates
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid query"));
        return;
      }
      const { search, category, limit, offset } = parsed.data;
      const result = await this.templateService.listTemplates(
        { search, category },
        req.tenantId!,
        { limit, offset }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/templates/:id
  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await this.templateService.getTemplate(req.params["id"]!);
      res.json(template);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/templates/:id/clone
  clone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.templateService.cloneTemplate(
        req.params["id"]!,
        req.tenantId!,
        req.user?.userId ?? "unknown"
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/templates
  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = PublishBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }
      const { workflowId, category, tags, isPublic } = parsed.data;
      const template = await this.templateService.publishWorkflowAsTemplate(
        workflowId,
        req.tenantId!,
        req.user?.userId ?? "unknown",
        { category, tags, isPublic }
      );
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  };
}
