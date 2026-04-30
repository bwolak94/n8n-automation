import { Router } from "express";
import type { MembersController } from "./MembersController.js";

export function createMembersRouter(controller: MembersController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/invite", controller.invite);
  router.patch("/:userId/role", controller.updateRole);
  router.delete("/:userId", controller.remove);
  return router;
}
