import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthService } from "./AuthService.js";

const LoginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  role: z.string().optional(),
  tenantId: z.string().optional(),
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = LoginSchema.parse(req.body);
      const result = await this.authService.login(body.email, body.password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = RegisterSchema.parse(req.body);
      const result = await this.authService.register(body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  logout = (_req: Request, res: Response): void => {
    res.status(204).end();
  };
}
