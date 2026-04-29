import { Router } from "express";
import type { NodeController } from "./NodeController.js";

export function createNodeRouter(controller: NodeController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.get("/:type", controller.get);

  return router;
}
