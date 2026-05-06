import { Router } from "express";
import { authorize } from "../../shared/middleware/authorize.js";
import type { MembersController } from "./MembersController.js";

export function createMembersRouter(controller: MembersController): Router {
  const router = Router();
  router.get("/", authorize("member:invite"), controller.list);
  router.post("/invite", authorize("member:invite"), controller.invite);
  router.patch("/:userId/role", authorize("member:changeRole"), controller.updateRole);
  router.delete("/:userId", authorize("member:remove"), controller.remove);
  return router;
}
