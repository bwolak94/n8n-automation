import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./openapi.js";
import mongoose from "mongoose";
import { pgPool } from "./config/database.js";
import { env } from "./config/env.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { authenticate } from "./shared/middleware/authenticate.js";
import { tenantContext } from "./shared/middleware/tenantContext.js";
import { NodeRegistry } from "./nodes/NodeRegistry.js";
import { registerBuiltInNodes } from "./nodes/registerBuiltInNodes.js";
import { ClaudeProvider } from "./nodes/ai/ClaudeProvider.js";
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
import { AnalyticsRepository } from "./modules/analytics/AnalyticsRepository.js";
import { AnalyticsService } from "./modules/analytics/AnalyticsService.js";
import { AnalyticsController } from "./modules/analytics/AnalyticsController.js";
import { createAnalyticsRouter } from "./modules/analytics/analytics.router.js";
import { MembersRepository } from "./modules/members/MembersRepository.js";
import { MembersController } from "./modules/members/MembersController.js";
import { createMembersRouter } from "./modules/members/members.router.js";
import { WebhookController } from "./modules/webhooks/WebhookController.js";
import { createWebhookRouter } from "./modules/webhooks/webhook.router.js";
import { AuthService } from "./modules/auth/AuthService.js";
import { AuthController } from "./modules/auth/AuthController.js";
import { createAuthRouter } from "./modules/auth/auth.router.js";
import { TenantRepository } from "./modules/tenants/TenantRepository.js";
import { TenantService } from "./modules/tenants/TenantService.js";
import { TenantController } from "./modules/tenants/TenantController.js";
import { createTenantRouter } from "./modules/tenants/tenant.router.js";
import { TenantNodeRegistry } from "./modules/marketplace/TenantNodeRegistry.js";
import { MarketplaceRepository } from "./modules/marketplace/MarketplaceRepository.js";
import { PackageValidator } from "./modules/marketplace/PackageValidator.js";
import { NodeInstaller } from "./modules/marketplace/NodeInstaller.js";
import { MarketplaceService } from "./modules/marketplace/MarketplaceService.js";
import { MarketplaceController } from "./modules/marketplace/MarketplaceController.js";
import { IntegrationRepository } from "./modules/marketplace/IntegrationRepository.js";
import { IntegrationService } from "./modules/marketplace/IntegrationService.js";
import { IntegrationController } from "./modules/marketplace/IntegrationController.js";
import { createMarketplaceRouter } from "./modules/marketplace/marketplace.router.js";
import type { IEnqueueable } from "./modules/workflows/WorkflowService.js";
import type { IDLQRepository } from "./modules/queue/IDLQRepository.js";

// ─── Injectable dependencies ──────────────────────────────────────────────────

export interface AppDeps {
  nodeRegistry?: NodeRegistry | TenantNodeRegistry;
  workflowQueue?: IEnqueueable | null;
  dlqRepository?: IDLQRepository | null;
  tenantNodeRegistry?: TenantNodeRegistry;
  marketplaceService?: MarketplaceService;
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

  // OpenAPI / Swagger UI — public, before auth middleware
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

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

  // ── Auth — public endpoints ─────────────────────────────────────────────────
  const authService = new AuthService();
  const authController = new AuthController(authService);
  app.use("/api/auth", createAuthRouter(authController));

  // ── Webhook — public (no auth), rate-limited ────────────────────────────────
  const workflowRepo = new WorkflowRepository();
  const webhookController = new WebhookController(
    workflowRepo,
    deps.workflowQueue ?? null
  );
  app.use("/api/webhooks", createWebhookRouter(webhookController));

  // ── Nodes — public, no auth required ───────────────────────────────────────
  const tenantNodeRegistry = deps.tenantNodeRegistry ?? new TenantNodeRegistry();
  const nodeRegistry = deps.nodeRegistry ?? tenantNodeRegistry;

  // Register all built-in nodes into the registry (idempotent when deps.nodeRegistry provided)
  if (!deps.nodeRegistry) {
    const aiProvider = env.ANTHROPIC_API_KEY ? new ClaudeProvider(env.ANTHROPIC_API_KEY) : undefined;
    registerBuiltInNodes(tenantNodeRegistry, aiProvider);
  }

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

  // ── Analytics ───────────────────────────────────────────────────────────────
  const analyticsRepo = new AnalyticsRepository(pgPool);
  const analyticsService = new AnalyticsService(analyticsRepo, workflowRepo);
  const analyticsController = new AnalyticsController(analyticsService);
  app.use("/api/analytics", createAnalyticsRouter(analyticsController));

  // ── Members ─────────────────────────────────────────────────────────────────
  const membersRepo = new MembersRepository();
  const membersController = new MembersController(membersRepo);
  app.use("/api/members", createMembersRouter(membersController));

  // ── Tenants (RBAC + invite flow) ────────────────────────────────────────────
  const tenantRepo = new TenantRepository();
  const tenantService = new TenantService(tenantRepo);
  const tenantController = new TenantController(tenantService);
  app.use("/api/tenants", createTenantRouter(tenantController));

  // ── Marketplace ─────────────────────────────────────────────────────────────
  let marketplaceService = deps.marketplaceService;
  if (!marketplaceService) {
    const marketplaceRepo = new MarketplaceRepository();
    const packageValidator = new PackageValidator();
    const nodeInstaller = new NodeInstaller(
      tenantNodeRegistry,
      marketplaceRepo,
      packageValidator,
      env.MARKETPLACE_UPLOAD_DIR
    );
    marketplaceService = new MarketplaceService(marketplaceRepo, packageValidator, nodeInstaller);
  }
  const marketplaceController = new MarketplaceController(marketplaceService);

  const integrationRepo       = new IntegrationRepository();
  const integrationService    = new IntegrationService(integrationRepo, workflowRepo);
  const integrationController = new IntegrationController(integrationService);

  app.use("/api/marketplace", createMarketplaceRouter(marketplaceController, integrationController));

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
