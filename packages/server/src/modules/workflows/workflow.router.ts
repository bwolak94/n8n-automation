import { Router } from "express";
import { CreateWorkflowSchema, UpdateWorkflowSchema } from "@automation-hub/shared";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import type { WorkflowController } from "./WorkflowController.js";

export function createWorkflowRouter(controller: WorkflowController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", validateRequest(CreateWorkflowSchema), controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", validateRequest(UpdateWorkflowSchema), controller.update);
  router.delete("/:id", controller.softDelete);
  router.post("/:id/execute", controller.execute);
  router.get("/:id/executions", controller.listExecutions);

  return router;
}
