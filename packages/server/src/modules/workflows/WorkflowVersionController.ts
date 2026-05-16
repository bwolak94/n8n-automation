import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { WorkflowVersionService } from "./WorkflowVersionService.js";
import type { WorkflowService } from "./WorkflowService.js";

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const DiffQuery = z.object({
  v1: z.coerce.number().int().positive(),
  v2: z.coerce.number().int().positive(),
});

const TagBody = z.object({
  label: z.string().min(1).max(255),
});

export class WorkflowVersionController {
  constructor(
    private readonly versionService: WorkflowVersionService,
    private readonly workflowService: WorkflowService
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify workflow belongs to tenant
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const { limit } = PaginationQuery.parse(req.query);
      const versions = await this.versionService.listVersions(
        req.params["id"]!,
        req.tenantId!,
        limit
      );
      res.json(versions);
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const v = parseInt(req.params["v"]!, 10);
      if (isNaN(v) || v < 1) {
        res.status(400).json({ error: "Invalid version number" });
        return;
      }

      const version = await this.versionService.getVersion(req.params["id"]!, req.tenantId!, v);
      res.json(version);
    } catch (err) {
      next(err);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const v = parseInt(req.params["v"]!, 10);
      if (isNaN(v) || v < 1) {
        res.status(400).json({ error: "Invalid version number" });
        return;
      }

      const userId = req.user?.userId ?? "system";
      const newVersion = await this.versionService.restoreVersion(
        req.params["id"]!,
        req.tenantId!,
        v,
        userId
      );
      res.json(newVersion);
    } catch (err) {
      next(err);
    }
  };

  tag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const v = parseInt(req.params["v"]!, 10);
      if (isNaN(v) || v < 1) {
        res.status(400).json({ error: "Invalid version number" });
        return;
      }

      const parsed = TagBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "label is required" });
        return;
      }

      const tagged = await this.versionService.tagVersion(
        req.params["id"]!,
        req.tenantId!,
        v,
        parsed.data.label
      );
      res.json(tagged);
    } catch (err) {
      next(err);
    }
  };

  diff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const parsed = DiffQuery.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "v1 and v2 query params are required and must be positive integers" });
        return;
      }

      const patch = await this.versionService.compareVersions(
        req.params["id"]!,
        req.tenantId!,
        parsed.data.v1,
        parsed.data.v2
      );
      res.json(patch);
    } catch (err) {
      next(err);
    }
  };
}
