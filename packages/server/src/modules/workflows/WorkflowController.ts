import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { WorkflowService } from "./WorkflowService.js";
import type { ExecutionService } from "../executions/ExecutionService.js";

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, offset } = PaginationQuery.parse(req.query);
      const result = await this.workflowService.findAll(req.tenantId!, { limit, offset });
      res.json({ ...result, limit, offset });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wf = await this.workflowService.findById(req.params["id"]!, req.tenantId!);
      res.json(wf);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wf = await this.workflowService.create(req.tenantId!, req.body as Record<string, unknown>);
      res.status(201).json(wf);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const wf = await this.workflowService.update(
        req.params["id"]!,
        req.tenantId!,
        req.body as Record<string, unknown>
      );
      res.json(wf);
    } catch (err) {
      next(err);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.workflowService.softDelete(req.params["id"]!, req.tenantId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  execute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const triggerData = (req.body as Record<string, unknown>) ?? {};
      const jobId = await this.workflowService.execute(
        req.params["id"]!,
        req.tenantId!,
        triggerData
      );
      res.status(202).json({ jobId });
    } catch (err) {
      next(err);
    }
  };

  listExecutions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify workflow exists + belongs to tenant
      await this.workflowService.findById(req.params["id"]!, req.tenantId!);

      const { limit, offset } = PaginationQuery.parse(req.query);
      const result = await this.executionService.findByWorkflowId(
        req.params["id"]!,
        req.tenantId!,
        { limit, offset }
      );
      res.json({ ...result, limit, offset });
    } catch (err) {
      next(err);
    }
  };
}
