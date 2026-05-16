import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/index.js";
import type { AuditLogService } from "./AuditLogService.js";

// ─── Validation ───────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  eventType:  z.string().optional(),
  actorId:    z.string().optional(),
  entityType: z.string().optional(),
  entityId:   z.string().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(50),
  offset:     z.coerce.number().int().min(0).default(0),
});

// ─── AuditLogController ───────────────────────────────────────────────────────

export class AuditLogController {
  constructor(private readonly auditService: AuditLogService) {}

  // GET /api/audit-logs
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = QuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid query"));
        return;
      }
      const { limit, offset, eventType, actorId, entityType, entityId, from, to } = parsed.data;
      const result = await this.auditService.query(
        req.tenantId!,
        { eventType, actorId, entityType, entityId, from, to },
        { limit, offset }
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/audit-logs/export
  export = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = QuerySchema.safeParse(req.query);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Invalid query"));
        return;
      }
      const { eventType, actorId, entityType, entityId, from, to } = parsed.data;
      const csv = await this.auditService.exportCsv(
        req.tenantId!,
        { eventType, actorId, entityType, entityId, from, to }
      );
      res.set({
        "Content-Type":        "text/csv",
        "Content-Disposition": 'attachment; filename="audit-logs.csv"',
      });
      res.send(csv);
    } catch (err) {
      next(err);
    }
  };
}
