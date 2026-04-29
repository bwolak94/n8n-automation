import { Router } from "express";
import { AuthController } from "./AuthController.js";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/login", controller.login);
  router.post("/register", controller.register);
  router.post("/logout", controller.logout);

  return router;
}
