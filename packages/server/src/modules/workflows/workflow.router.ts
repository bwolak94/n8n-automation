import { Router } from "express";
import { CreateWorkflowSchema, UpdateWorkflowSchema } from "@automation-hub/shared";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { authorize } from "../../shared/middleware/authorize.js";
import type { WorkflowController } from "./WorkflowController.js";
import type { WorkflowVersionController } from "./WorkflowVersionController.js";

export function createWorkflowRouter(
  controller: WorkflowController,
  versionController?: WorkflowVersionController
): Router {
  const router = Router();

  router.get("/", authorize("workflow:read"), controller.list);
  router.post("/", authorize("workflow:create"), validateRequest(CreateWorkflowSchema), controller.create);
  router.get("/:id", authorize("workflow:read"), controller.get);
  router.put("/:id", authorize("workflow:update"), validateRequest(UpdateWorkflowSchema), controller.update);
  router.delete("/:id", authorize("workflow:delete"), controller.softDelete);
  router.post("/:id/execute", authorize("workflow:execute"), controller.execute);
  router.get("/:id/executions", authorize("execution:read"), controller.listExecutions);

  if (versionController) {
    // NOTE: /diff must be registered before /:v to prevent Express matching "diff" as :v
    router.get("/:id/versions/diff", authorize("workflow:read"), versionController.diff);
    router.get("/:id/versions", authorize("workflow:read"), versionController.list);
    router.get("/:id/versions/:v", authorize("workflow:read"), versionController.get);
    router.post("/:id/versions/:v/restore", authorize("workflow:update"), versionController.restore);
    router.post("/:id/versions/:v/tag", authorize("workflow:update"), versionController.tag);
  }

  return router;
}
