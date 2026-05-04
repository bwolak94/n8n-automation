import { Router } from "express";
import type { CredentialController } from "./CredentialController.js";

export function createCredentialRouter(controller: CredentialController): Router {
  const router = Router();

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.put("/:id", controller.update);
  router.delete("/:id", controller.remove);
  router.post("/:id/test", controller.test);

  return router;
}
