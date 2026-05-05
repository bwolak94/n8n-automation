import { Router } from "express";
import type { TemplateController } from "./TemplateController.js";

export function createTemplateRouter(controller: TemplateController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", controller.publish);
  router.get("/:id", controller.get);
  router.post("/:id/clone", controller.clone);

  return router;
}
