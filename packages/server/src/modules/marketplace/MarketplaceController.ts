import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/index.js";
import type { MarketplaceService } from "./MarketplaceService.js";

// ─── Validation schemas ───────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  search:   z.string().optional(),
  category: z.string().optional(),
  sort:     z.enum(["downloads", "rating", "newest"]).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

const PublishBodySchema = z.object({
  name:        z.string().min(1),
  version:     z.string().min(1).regex(/^\d+\.\d+\.\d+$/, "Must be semver (e.g. 1.0.0)"),
  description: z.string().optional(),
  author:      z.string().min(1),
  nodeType:    z.string().min(1).regex(/^[a-z0-9-_]+$/, "nodeType must be lowercase alphanumeric with dashes/underscores"),
  category:    z.string().optional(),
  tags:        z.array(z.string()).optional(),
  config:      z.record(z.unknown()),  // automation-hub.config object
});

// ─── MarketplaceController ────────────────────────────────────────────────────

export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  // GET /api/marketplace/nodes
  listPackages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid query"));
        return;
      }
      const result = await this.marketplaceService.listPackages(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/marketplace/nodes
  publishPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = PublishBodySchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }

      const pkg = await this.marketplaceService.publishPackage({
        ...parsed.data,
        configObject: parsed.data.config,
        publisherId: req.user?.userId ?? "unknown",
      });

      res.status(201).json(pkg);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/marketplace/nodes/:id/install
  installPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = await this.marketplaceService.installPackage(
        req.tenantId!,
        req.params["id"]!
      );
      res.status(201).json(record);
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/marketplace/nodes/:id/install
  uninstallPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.marketplaceService.uninstallPackage(
        req.tenantId!,
        req.params["id"]!
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  // GET /api/marketplace/installed
  listInstalled = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.marketplaceService.listInstalled(req.tenantId!);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  };
}
