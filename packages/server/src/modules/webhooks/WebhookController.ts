import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../../shared/errors/index.js";
import type { WorkflowRepository } from "../workflows/WorkflowRepository.js";
import type { IEnqueueable } from "../workflows/WorkflowService.js";

export class WebhookController {
  constructor(
    private readonly workflowRepo: WorkflowRepository,
    private readonly queue: IEnqueueable | null
  ) {}

  trigger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workflowId, path: webhookPath } = req.params as {
        workflowId: string;
        path: string;
      };

      // Look up workflow by id (any tenant — workflowId is the shared "secret")
      // We use the engine findById without tenantId filter by searching the model directly
      const workflow = await this.workflowRepo.findByIdForWebhook(workflowId);
      if (!workflow) {
        throw new NotFoundError("Workflow not found");
      }

      // Verify a webhook node with matching path exists
      const hasMatchingWebhook = workflow.nodes.some(
        (n) => n.type === "webhook" && n.config["path"] === webhookPath
      );
      if (!hasMatchingWebhook) {
        throw new NotFoundError(`No webhook registered at path '${webhookPath}'`);
      }

      const triggerData = {
        method: req.method,
        headers: req.headers,
        body: req.body as unknown,
        query: req.query,
      };

      if (this.queue) {
        await this.queue.enqueue(workflowId, triggerData, workflow.tenantId);
      }

      res.status(202).json({ accepted: true, workflowId });
    } catch (err) {
      next(err);
    }
  };
}
