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
import { WorkflowVersionRepository } from "./modules/workflows/WorkflowVersionRepository.js";
import { WorkflowVersionService } from "./modules/workflows/WorkflowVersionService.js";
import { WorkflowVersionController } from "./modules/workflows/WorkflowVersionController.js";
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
import { WebhookRepository } from "./modules/webhooks/WebhookRepository.js";
import { WebhookHandler } from "./modules/webhooks/WebhookHandler.js";
import { createIncomingWebhookRouter } from "./modules/webhooks/incoming.webhook.router.js";
import { WebhookManagementController } from "./modules/webhooks/WebhookManagementController.js";
import { createWebhookManagementRouter } from "./modules/webhooks/webhook.management.router.js";
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
import { CredentialEncryption } from "./modules/credentials/CredentialEncryption.js";
import { CredentialRepository } from "./modules/credentials/CredentialRepository.js";
import { CredentialService } from "./modules/credentials/CredentialService.js";
import { CredentialController } from "./modules/credentials/CredentialController.js";
import { createCredentialRouter } from "./modules/credentials/credential.router.js";
import { DatabaseClientFactory } from "./nodes/implementations/db/DatabaseClientFactory.js";
import { BranchSyncManager } from "./engine/BranchSyncManager.js";
import { redis } from "./config/redis.js";
import { TemplateRepository } from "./modules/templates/TemplateRepository.js";
import { TemplateService } from "./modules/templates/TemplateService.js";
import { TemplateController } from "./modules/templates/TemplateController.js";
import { createTemplateRouter } from "./modules/templates/template.router.js";
import { AuditLogRepository } from "./modules/audit/AuditLogRepository.js";
import { AuditLogService } from "./modules/audit/AuditLogService.js";
import { AuditLogController } from "./modules/audit/AuditLogController.js";
import { createAuditRouter } from "./modules/audit/audit.router.js";
import cron from "node-cron";
import type { IEnqueueable } from "./modules/workflows/WorkflowService.js";
import type { IDLQRepository } from "./modules/queue/IDLQRepository.js";
import type { IPrometheusMetrics } from "./observability/PrometheusMetrics.js";

// ─── Injectable dependencies ──────────────────────────────────────────────────

export interface AppDeps {
  nodeRegistry?: NodeRegistry | TenantNodeRegistry;
  workflowQueue?: IEnqueueable | null;
  dlqRepository?: IDLQRepository | null;
  tenantNodeRegistry?: TenantNodeRegistry;
  marketplaceService?: MarketplaceService;
  prometheusMetrics?: IPrometheusMetrics;
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

  // Prometheus metrics — public, scraped by Prometheus every 15s
  if (deps.prometheusMetrics) {
    const metrics = deps.prometheusMetrics;
    app.get("/metrics", async (_req, res) => {
      res.set("Content-Type", metrics.getContentType());
      res.send(await metrics.getMetricsString());
    });
  }

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

  // ── Incoming webhooks — public (no auth), raw body for HMAC ────────────────
  // IMPORTANT: mounted before express.json() to preserve raw body Buffer
  const webhookRepo = new WebhookRepository();
  const webhookHandler = new WebhookHandler(webhookRepo, deps.workflowQueue ?? null);
  app.use("/api/w", createIncomingWebhookRouter(webhookHandler));

  // ── Webhook (legacy path-based trigger) — public, rate-limited ─────────────
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
    // Build credential vault early so DatabaseNode can resolve credentials at execution time
    const nodeCredEncryption = new CredentialEncryption(env.MASTER_ENCRYPTION_KEY);
    const nodeCredRepo = new CredentialRepository();
    const nodeCredService = new CredentialService(nodeCredRepo, nodeCredEncryption);
    const nodeDbFactory = new DatabaseClientFactory();
    const branchSyncManager = new BranchSyncManager(redis);
    registerBuiltInNodes(tenantNodeRegistry, aiProvider, {
      credentialVault: nodeCredService,
      dbClientFactory: nodeDbFactory,
      branchSyncManager,
    });
  }

  const nodeController = new NodeController(nodeRegistry);
  app.use("/api/nodes", createNodeRouter(nodeController));

  // Authentication — all routes below require a valid JWT
  app.use(authenticate);

  // Tenant context — must run after authenticate
  app.use(tenantContext);

  // ── Webhook management (authenticated) ─────────────────────────────────────
  const webhookManagementController = new WebhookManagementController(webhookRepo);
  app.use("/api/webhooks", createWebhookManagementRouter(webhookManagementController));

  // ── Audit Log service (created early — injected into other controllers) ─────
  const auditRepo    = new AuditLogRepository(pgPool);
  const auditService = new AuditLogService(auditRepo);

  // ── Workflows ───────────────────────────────────────────────────────────────
  const executionRepo = new ExecutionLogRepository(pgPool);
  const executionService = new ExecutionService(executionRepo);
  const workflowVersionRepo = new WorkflowVersionRepository();
  const workflowService = new WorkflowService(workflowRepo, deps.workflowQueue ?? null);
  const workflowVersionService = new WorkflowVersionService(workflowVersionRepo, workflowRepo);
  const workflowVersionController = new WorkflowVersionController(workflowVersionService, workflowService);
  const workflowController = new WorkflowController(workflowService, executionService, workflowVersionService, auditService);
  app.use("/api/workflows", createWorkflowRouter(workflowController, workflowVersionController));

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

  // ── Credentials ─────────────────────────────────────────────────────────────
  const credentialEncryption = new CredentialEncryption(env.MASTER_ENCRYPTION_KEY);
  const credentialRepository = new CredentialRepository();
  const credentialService = new CredentialService(credentialRepository, credentialEncryption);
  const credentialController = new CredentialController(credentialService, auditService);
  app.use("/api/credentials", createCredentialRouter(credentialController));

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

  // ── Templates ────────────────────────────────────────────────────────────────
  const templateRepo       = new TemplateRepository();
  const templateService    = new TemplateService(templateRepo, workflowService);
  const templateController = new TemplateController(templateService);
  app.use("/api/templates", createTemplateRouter(templateController));

  // ── Audit Logs ───────────────────────────────────────────────────────────────
  const auditController = new AuditLogController(auditService);
  app.use("/api/audit-logs", createAuditRouter(auditController));

  // Nightly retention cleanup — runs at 03:00 UTC every day
  cron.schedule("0 3 * * *", async () => {
    try {
      const deleted = await auditService.runRetentionCleanup(env.AUDIT_LOG_RETENTION_DAYS);
      console.log(`[audit] Retention cleanup deleted ${deleted} records older than ${env.AUDIT_LOG_RETENTION_DAYS} days`);
    } catch (err) {
      process.stderr.write(`[audit] Retention cleanup failed: ${String(err)}\n`);
    }
  });

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
