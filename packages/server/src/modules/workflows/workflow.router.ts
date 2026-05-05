import { Router } from "express";
import { CreateWorkflowSchema, UpdateWorkflowSchema } from "@automation-hub/shared";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import type { WorkflowController } from "./WorkflowController.js";
import type { WorkflowVersionController } from "./WorkflowVersionController.js";

export function createWorkflowRouter(
  controller: WorkflowController,
  versionController?: WorkflowVersionController
): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", validateRequest(CreateWorkflowSchema), controller.create);
  router.get("/:id", controller.get);
  router.put("/:id", validateRequest(UpdateWorkflowSchema), controller.update);
  router.delete("/:id", controller.softDelete);
  router.post("/:id/execute", controller.execute);
  router.get("/:id/executions", controller.listExecutions);

  if (versionController) {
    // NOTE: /diff must be registered before /:v to prevent Express matching "diff" as :v
    router.get("/:id/versions/diff", versionController.diff);
    router.get("/:id/versions", versionController.list);
    router.get("/:id/versions/:v", versionController.get);
    router.post("/:id/versions/:v/restore", versionController.restore);
    router.post("/:id/versions/:v/tag", versionController.tag);
  }

  return router;
}
