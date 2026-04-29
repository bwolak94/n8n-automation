import { createApp } from "./app.js";
import { connectDatabases } from "./config/database.js";
import { env } from "./config/env.js";
import { redis } from "./config/redis.js";
import { createBullMQDLQRepository } from "./modules/queue/BullMQDLQRepository.js";
import { createWorkflowQueue } from "./jobs/queues/workflowQueue.js";

async function main(): Promise<void> {
  await connectDatabases();

  const workflowQueue = createWorkflowQueue(redis);
  const dlqRepository = createBullMQDLQRepository(redis);

  const app = createApp({ workflowQueue, dlqRepository });

  const server = app.listen(env.PORT, () => {
    console.log(
      `[Server] Listening on port ${env.PORT} in ${env.NODE_ENV} mode`
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await workflowQueue.close();
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
