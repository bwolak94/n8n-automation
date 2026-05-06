import { createServer } from "http";
import { createApp } from "./app.js";
import { connectDatabases, pgPool } from "./config/database.js";
import { seedTemplates } from "./seeds/seedTemplates.js";
import { env } from "./config/env.js";
import { redis, bullmqRedis } from "./config/redis.js";
import { Redis } from "ioredis";
import { createBullMQDLQRepository } from "./modules/queue/BullMQDLQRepository.js";
import { createWorkflowQueue } from "./jobs/queues/workflowQueue.js";
import { createDLQQueue } from "./jobs/queues/dlqQueue.js";
import { createWorkflowWorkerService } from "./jobs/workers/workflowWorker.js";
import { WorkflowRunner } from "./engine/WorkflowRunner.js";
import { NodeExecutor } from "./engine/NodeExecutor.js";
import { TopologicalSorter } from "./engine/TopologicalSorter.js";
import { EventBus } from "./engine/EventBus.js";
import { ExpressionEvaluator } from "./engine/ExpressionEvaluator.js";
import { RetryManager } from "./engine/RetryManager.js";
import { TenantNodeRegistry } from "./modules/marketplace/TenantNodeRegistry.js";
import { registerBuiltInNodes } from "./nodes/registerBuiltInNodes.js";
import { ClaudeProvider } from "./nodes/ai/ClaudeProvider.js";
import { WorkflowRepository } from "./modules/workflows/WorkflowRepository.js";
import { ExecutionLogRepository } from "./modules/executions/ExecutionLogRepository.js";
import { OpLogRepository } from "./modules/collaboration/OpLogRepository.js";
import { CollaborationGateway } from "./modules/collaboration/CollaborationGateway.js";
import { DebugRunner } from "./engine/DebugRunner.js";
import { DebugGateway } from "./modules/debug/DebugGateway.js";
import { LokiLogger, NoopLokiLogger } from "./observability/LokiLogger.js";
import { PrometheusMetrics } from "./observability/PrometheusMetrics.js";
import { ObservabilityService } from "./observability/ObservabilityService.js";

async function main(): Promise<void> {
  await connectDatabases();
  await seedTemplates();

  const workflowQueue = createWorkflowQueue(bullmqRedis);
  const dlqRepository = createBullMQDLQRepository(bullmqRedis, workflowQueue);

  // ── Observability ────────────────────────────────────────────────────────────
  const lokiLogger = env.LOKI_URL ? new LokiLogger(env.LOKI_URL) : new NoopLokiLogger();
  const prometheusMetrics = new PrometheusMetrics();

  // ── Execution engine ────────────────────────────────────────────────────────
  const dlqQueue = createDLQQueue(bullmqRedis);
  const eventBus = new EventBus();
  new ObservabilityService(eventBus, lokiLogger, prometheusMetrics);
  const evaluator = new ExpressionEvaluator();
  const retryManager = new RetryManager(dlqQueue);

  const tenantNodeRegistry = new TenantNodeRegistry();
  const aiProvider = env.ANTHROPIC_API_KEY
    ? new ClaudeProvider(env.ANTHROPIC_API_KEY)
    : undefined;
  registerBuiltInNodes(tenantNodeRegistry, aiProvider);

  const nodeExecutor = new NodeExecutor(tenantNodeRegistry, evaluator, retryManager, eventBus);
  const sorter = new TopologicalSorter();
  const workflowRepo = new WorkflowRepository();
  const executionLogRepo = new ExecutionLogRepository(pgPool);
  const runner = new WorkflowRunner(workflowRepo, executionLogRepo, nodeExecutor, sorter, eventBus);

  // ── BullMQ worker ───────────────────────────────────────────────────────────
  const workerService = createWorkflowWorkerService(
    runner,
    dlqQueue,
    bullmqRedis,
    env.WORKER_CONCURRENCY
  );

  // ── Express app ─────────────────────────────────────────────────────────────
  const app = createApp({ workflowQueue, dlqRepository, nodeRegistry: tenantNodeRegistry, prometheusMetrics, resumableQueue: workflowQueue });

  // ── HTTP server (shared with Socket.io) ─────────────────────────────────────
  const httpServer = createServer(app);

  // ── Collaboration gateway (Socket.io + Redis pub/sub) ───────────────────────
  const pubClient = new Redis(env.REDIS_URL);
  const subClient = new Redis(env.REDIS_URL);
  const opLogRepo = new OpLogRepository();
  const collaborationGateway = new CollaborationGateway(
    httpServer,
    opLogRepo,
    env.CORS_ORIGIN,
    pubClient,
    subClient
  );

  // ── Debug gateway (Socket.io /debug namespace) ───────────────────────────────
  const debugRunner  = new DebugRunner(workflowRepo, nodeExecutor, sorter, redis);
  const _debugGateway = new DebugGateway(collaborationGateway.io, debugRunner);

  httpServer.listen(env.PORT, () => {
    console.log(
      `[Server] Listening on port ${env.PORT} in ${env.NODE_ENV} mode`
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    httpServer.close(async () => {
      await collaborationGateway.io.close();
      await workerService.close();
      await workflowQueue.close();
      await dlqQueue.close();
      await pubClient.quit();
      await subClient.quit();
      await redis.quit();
      await bullmqRedis.quit();
      console.log("[Server] Shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
