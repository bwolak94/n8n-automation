import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { pgPool } from "./config/database.js";
import { env } from "./config/env.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { authenticate } from "./shared/middleware/authenticate.js";
import { tenantContext } from "./shared/middleware/tenantContext.js";
import { NodeRegistry } from "./nodes/NodeRegistry.js";
import { WorkflowRepository } from "./modules/workflows/WorkflowRepository.js";
import { WorkflowService } from "./modules/workflows/WorkflowService.js";
import { WorkflowController } from "./modules/workflows/WorkflowController.js";
import { createWorkflowRouter } from "./modules/workflows/workflow.router.js";
import { ExecutionLogRepository } from "./modules/executions/ExecutionLogRepository.js";
import { ExecutionService } from "./modules/executions/ExecutionService.js";
import { ExecutionController } from "./modules/executions/ExecutionController.js";
import { createExecutionRouter } from "./modules/executions/execution.router.js";
import { NodeController } from "./modules/nodes/NodeController.js";
import { createNodeRouter } from "./modules/nodes/node.router.js";
import { QueueController } from "./modules/queue/QueueController.js";
import { createQueueRouter } from "./modules/queue/queue.router.js";
import { WebhookController } from "./modules/webhooks/WebhookController.js";
import { createWebhookRouter } from "./modules/webhooks/webhook.router.js";
import type { IEnqueueable } from "./modules/workflows/WorkflowService.js";
import type { IDLQRepository } from "./modules/queue/IDLQRepository.js";

// ─── Injectable dependencies ──────────────────────────────────────────────────

export interface AppDeps {
  nodeRegistry?: NodeRegistry;
  workflowQueue?: IEnqueueable | null;
  dlqRepository?: IDLQRepository | null;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));

  // Parse JSON bodies
  app.use(express.json());

  // Health check — public, before auth middleware
  app.get("/health", async (_req, res) => {
    const mongoStatus =
      mongoose.connection.readyState === 1 ? "ok" : "degraded";

    let pgStatus: "ok" | "degraded" = "degraded";
    try {
      const client = await pgPool.connect();
      await client.query("SELECT 1");
      client.release();
      pgStatus = "ok";
    } catch {
      // pgStatus stays 'degraded'
    }

    res.status(200).json({
      status: "ok",
      databases: { mongo: mongoStatus, postgres: pgStatus },
    });
  });

  // ── Webhook — public (no auth), rate-limited ────────────────────────────────
  const workflowRepo = new WorkflowRepository();
  const webhookController = new WebhookController(
    workflowRepo,
    deps.workflowQueue ?? null
  );
  app.use("/api/webhooks", createWebhookRouter(webhookController));

  // ── Nodes — public, no auth required ───────────────────────────────────────
  const nodeRegistry = deps.nodeRegistry ?? new NodeRegistry();
  const nodeController = new NodeController(nodeRegistry);
  app.use("/api/nodes", createNodeRouter(nodeController));

  // Authentication — all routes below require a valid JWT
  app.use(authenticate);

  // Tenant context — must run after authenticate
  app.use(tenantContext);

  // ── Workflows ───────────────────────────────────────────────────────────────
  const executionRepo = new ExecutionLogRepository(pgPool);
  const executionService = new ExecutionService(executionRepo);
  const workflowService = new WorkflowService(workflowRepo, deps.workflowQueue ?? null);
  const workflowController = new WorkflowController(workflowService, executionService);
  app.use("/api/workflows", createWorkflowRouter(workflowController));

  // ── Executions ──────────────────────────────────────────────────────────────
  const executionController = new ExecutionController(executionService);
  app.use("/api/executions", createExecutionRouter(executionController));

  // ── Queue / DLQ ─────────────────────────────────────────────────────────────
  if (deps.dlqRepository) {
    const queueController = new QueueController(deps.dlqRepository);
    app.use("/api/queue", createQueueRouter(queueController));
  }

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
