import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "../errors/index.js";

type ValidateTarget = "body" | "query" | "params";

export function validateRequest<T extends ZodTypeAny>(
  schema: T,
  target: ValidateTarget = "body"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path,
        message: e.message,
      }));
      next(new ValidationError("Validation failed", errors));
      return;
    }

    // Double-cast: Request has no index signature, so we go via unknown first
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
}
