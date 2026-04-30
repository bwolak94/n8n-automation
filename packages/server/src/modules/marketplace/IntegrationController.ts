import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/index.js";
import {
  ListTemplatesQuerySchema,
  InstallTemplateSchema,
  PublishTemplateSchema,
} from "@automation-hub/shared";
import type { IntegrationService } from "./IntegrationService.js";

export class IntegrationController {
  constructor(private readonly service: IntegrationService) {
    this.listTemplates   = this.listTemplates.bind(this);
    this.getTemplate     = this.getTemplate.bind(this);
    this.installTemplate = this.installTemplate.bind(this);
    this.publishTemplate = this.publishTemplate.bind(this);
  }

  // GET /api/integrations/templates
  async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = ListTemplatesQuerySchema.parse(req.query);
      const result = await this.service.listTemplates(query);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError(err.errors[0]?.message ?? "Invalid query"));
      }
      next(err);
    }
  }

  // GET /api/integrations/templates/:id
  async getTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await this.service.getTemplate(req.params["id"] ?? "");
      res.json(template);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/integrations/templates/:id/install
  async installTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return next(new ValidationError("Tenant context is required"));
      }
      const body = InstallTemplateSchema.parse(req.body);
      const workflow = await this.service.installTemplate(
        tenantId,
        req.params["id"] ?? "",
        body
      );
      res.status(201).json(workflow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError(err.errors[0]?.message ?? "Invalid request body"));
      }
      next(err);
    }
  }

  // POST /api/integrations/templates
  async publishTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId;
      const userId   = req.user?.userId;
      if (!tenantId || !userId) {
        return next(new ValidationError("Auth and tenant context are required"));
      }
      const body = PublishTemplateSchema.parse(req.body);
      const template = await this.service.publishTemplate({
        ...body,
        tenantId,
        userId,
        userDisplayName: req.user?.email ?? userId,
      });
      res.status(201).json(template);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ValidationError(err.errors[0]?.message ?? "Invalid request body"));
      }
      next(err);
    }
  }
}
