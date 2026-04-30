import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type { Redis } from "ioredis";

// ─── Job Data ─────────────────────────────────────────────────────────────────

export interface WorkflowJobData {
  readonly workflowId: string;
  readonly tenantId: string;
  readonly triggerData: Record<string, unknown>;
}

// ─── Adapter interface (enables constructor injection + testability) ──────────

export interface QueueAdapter<T> {
  add(
    name: string,
    data: T,
    opts?: JobsOptions
  ): Promise<{ id?: string | undefined }>;
  close(): Promise<void>;
}

// ─── WorkflowQueue ────────────────────────────────────────────────────────────

export class WorkflowQueue {
  static readonly QUEUE_NAME = "workflow-execution";

  constructor(private readonly queue: QueueAdapter<WorkflowJobData>) {}

  /**
   * Enqueue a workflow execution job.
   * Uses `${tenantId}:${workflowId}` as the BullMQ jobId — BullMQ will silently
   * return the existing job when the same ID is submitted again, providing
   * natural deduplication for workflows that fire at the same tick.
   */
  async enqueue(
    workflowId: string,
    triggerData: Record<string, unknown>,
    tenantId: string
  ): Promise<string> {
    const job = await this.queue.add(
      "run",
      { workflowId, tenantId, triggerData },
      {
        jobId: `${tenantId}_${workflowId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
      }
    );
    return job.id ?? "";
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

// ─── Production factory (excluded from unit-test coverage) ───────────────────

/* istanbul ignore next */
export function createWorkflowQueue(connection: Redis): WorkflowQueue {
  const queue = new Queue<WorkflowJobData>(WorkflowQueue.QUEUE_NAME, {
    connection,
  });
  return new WorkflowQueue(queue as unknown as QueueAdapter<WorkflowJobData>);
}
