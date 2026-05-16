import { Router } from "express";
import { authorize } from "../../shared/middleware/authorize.js";
import type { CredentialController } from "./CredentialController.js";

export function createCredentialRouter(controller: CredentialController): Router {
  const router = Router();

  router.post("/", authorize("credential:create"), controller.create);
  router.get("/", authorize("credential:read"), controller.list);
  router.get("/:id", authorize("credential:read"), controller.getById);
  router.put("/:id", authorize("credential:create"), controller.update);
  router.delete("/:id", authorize("credential:delete"), controller.remove);
  router.post("/:id/test", authorize("credential:read"), controller.test);

  return router;
}
