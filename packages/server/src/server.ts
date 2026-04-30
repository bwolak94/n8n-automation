import { createApp } from "./app.js";
import { connectDatabases, pgPool } from "./config/database.js";
import { env } from "./config/env.js";
import { redis } from "./config/redis.js";
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

async function main(): Promise<void> {
  await connectDatabases();

  const workflowQueue = createWorkflowQueue(redis);
  const dlqRepository = createBullMQDLQRepository(redis);

  // ── Execution engine ────────────────────────────────────────────────────────
  const dlqQueue = createDLQQueue(redis);
  const eventBus = new EventBus();
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
    redis,
    env.WORKER_CONCURRENCY
  );

  // Pass shared registry so API and worker use the same node definitions
  const app = createApp({ workflowQueue, dlqRepository, nodeRegistry: tenantNodeRegistry });

  const server = app.listen(env.PORT, () => {
    console.log(
      `[Server] Listening on port ${env.PORT} in ${env.NODE_ENV} mode`
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await workerService.close();
      await workflowQueue.close();
      await dlqQueue.close();
      await redis.quit();
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
