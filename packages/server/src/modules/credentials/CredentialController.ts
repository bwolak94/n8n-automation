import type { NextFunction, Request, Response } from "express";
import { CredentialCreateSchema, CredentialUpdateSchema } from "@automation-hub/shared";
import { ValidationError } from "../../shared/errors/index.js";
import type { CredentialService } from "./CredentialService.js";

export class CredentialController {
  constructor(private readonly credentialService: CredentialService) {}

  // POST /api/credentials
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CredentialCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }
      const credential = await this.credentialService.createCredential(
        req.tenantId!,
        parsed.data
      );
      res.status(201).json(credential);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/credentials
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.credentialService.listCredentials(req.tenantId!);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/credentials/:id
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const credential = await this.credentialService.getCredentialSummary(
        req.tenantId!,
        req.params["id"]!
      );
      res.json(credential);
    } catch (err) {
      next(err);
    }
  };

  // PUT /api/credentials/:id
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CredentialUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError(parsed.error.errors[0]?.message ?? "Validation failed"));
        return;
      }
      const credential = await this.credentialService.updateCredential(
        req.tenantId!,
        req.params["id"]!,
        parsed.data
      );
      res.json(credential);
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/credentials/:id
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.credentialService.deleteCredential(req.tenantId!, req.params["id"]!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  // POST /api/credentials/:id/test
  test = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify credential exists for this tenant (also validates ownership)
      const credential = await this.credentialService.getCredentialSummary(
        req.tenantId!,
        req.params["id"]!
      );
      // Type-specific connection test can be added here; currently validates existence
      res.json({ ok: true, type: credential.type, name: credential.name });
    } catch (err) {
      next(err);
    }
  };
}
