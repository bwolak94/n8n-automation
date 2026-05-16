import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { NotFoundError } from "../../shared/errors/index.js";
import type { MembersRepository } from "./MembersRepository.js";

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
});

const RoleSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "viewer"]),
});

export class MembersController {
  constructor(private readonly membersRepo: MembersRepository) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const members = await this.membersRepo.findAll(req.tenantId!);
      res.json({ items: members, total: members.length });
    } catch (err) {
      next(err);
    }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, role } = InviteSchema.parse(req.body);
      const member = await this.membersRepo.invite(req.tenantId!, email, role);
      res.status(201).json(member);
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = RoleSchema.parse(req.body);
      const updated = await this.membersRepo.updateRole(req.tenantId!, req.params["userId"]!, role);
      if (!updated) next(new NotFoundError(`Member '${req.params["userId"]}' not found`));
      else res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const removed = await this.membersRepo.remove(req.tenantId!, req.params["userId"]!);
      if (!removed) next(new NotFoundError(`Member '${req.params["userId"]}' not found`));
      else res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
