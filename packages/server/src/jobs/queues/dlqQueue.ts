import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { FailedJob, IDLQueue } from "../../engine/RetryManager.js";
import type { QueueAdapter } from "./workflowQueue.js";

// ─── DLQ Job Data ─────────────────────────────────────────────────────────────

export interface DLQJobData {
  readonly nodeId: string;
  readonly executionId: string;
  readonly tenantId: string;
  readonly errorMessage: string;
  readonly retryCount: number;
  readonly payload: unknown;
  readonly lastAttemptAt: string; // ISO-8601
}

// ─── BullMQDLQueue ────────────────────────────────────────────────────────────

export class BullMQDLQueue implements IDLQueue {
  static readonly QUEUE_NAME = "workflow-dlq";

  constructor(private readonly queue: QueueAdapter<DLQJobData>) {}

  async add(job: FailedJob): Promise<void> {
    await this.queue.add(
      "dlq",
      {
        nodeId: job.nodeId,
        executionId: job.executionId,
        tenantId: job.tenantId,
        errorMessage: job.error.message,
        retryCount: job.attempts,
        payload: job.payload,
        lastAttemptAt: new Date().toISOString(),
      },
      {
        removeOnFail: false,
        removeOnComplete: false,
      }
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

// ─── Production factory (excluded from unit-test coverage) ───────────────────

/* istanbul ignore next */
export function createDLQQueue(connection: Redis): BullMQDLQueue {
  const queue = new Queue<DLQJobData>(BullMQDLQueue.QUEUE_NAME, {
    connection,
  });
  return new BullMQDLQueue(queue as unknown as QueueAdapter<DLQJobData>);
}
