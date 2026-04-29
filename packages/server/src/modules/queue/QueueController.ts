import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { NotFoundError } from "../../shared/errors/index.js";
import type { IDLQRepository } from "./IDLQRepository.js";

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export class QueueController {
  constructor(private readonly dlqRepo: IDLQRepository) {}

  listDLQ = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { limit, offset } = PaginationQuery.parse(req.query);
      const result = await this.dlqRepo.list(offset, limit);
      res.json({ ...result, limit, offset });
    } catch (err) {
      next(err);
    }
  };

  retryJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.dlqRepo.retry(req.params["jobId"]!);
      res.status(204).end();
    } catch (err) {
      if ((err as Error).message?.includes("not found")) {
        next(new NotFoundError(`DLQ job '${req.params["jobId"]}' not found`));
      } else {
        next(err);
      }
    }
  };

  discardJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.dlqRepo.discard(req.params["jobId"]!);
      res.status(204).end();
    } catch (err) {
      if ((err as Error).message?.includes("not found")) {
        next(new NotFoundError(`DLQ job '${req.params["jobId"]}' not found`));
      } else {
        next(err);
      }
    }
  };
}
