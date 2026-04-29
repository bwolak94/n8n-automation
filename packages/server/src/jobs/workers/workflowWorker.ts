import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { IDLQueue } from "../../engine/RetryManager.js";
import type { WorkflowJobData } from "../queues/workflowQueue.js";
import { WorkflowQueue } from "../queues/workflowQueue.js";

// ─── Minimal interfaces (injection + testability) ─────────────────────────────

export interface WorkflowRunnerLike {
  run(
    workflowId: string,
    tenantId: string,
    triggerData: Record<string, unknown>
  ): Promise<unknown>;
}

export interface MinimalJob {
  readonly data: WorkflowJobData;
  readonly opts: { readonly attempts?: number };
  readonly attemptsMade: number;
}

export interface WorkerLike {
  on(
    event: "failed",
    handler: (
      job: MinimalJob | undefined,
      err: Error
    ) => void | Promise<void>
  ): void;
  close(): Promise<void>;
}

// ─── Pure processor function ──────────────────────────────────────────────────

/**
 * The core job processor — pure function with no BullMQ coupling.
 * Tested directly without instantiating a Worker.
 */
export async function processWorkflowJob(
  job: Pick<MinimalJob, "data">,
  runner: WorkflowRunnerLike
): Promise<void> {
  const { workflowId, tenantId, triggerData } = job.data;
  await runner.run(workflowId, tenantId, triggerData);
}

// ─── Pure exhausted-retry handler ─────────────────────────────────────────────

/**
 * Called on BullMQ's `failed` event.
 * Moves the job to the DLQ only when all attempts are exhausted.
 */
export async function handleExhaustedJob(
  job: MinimalJob | undefined,
  err: Error,
  dlq: IDLQueue
): Promise<void> {
  if (!job) return;
  const maxAttempts = job.opts.attempts ?? 1;
  if (job.attemptsMade < maxAttempts) return;

  await dlq.add({
    nodeId: "workflow-runner",
    executionId: job.data.workflowId,
    tenantId: job.data.tenantId,
    error: err,
    attempts: job.attemptsMade,
    payload: job.data,
  });
}

// ─── Service class ────────────────────────────────────────────────────────────

export class WorkflowWorkerService {
  constructor(
    runner: WorkflowRunnerLike,
    dlq: IDLQueue,
    private readonly worker: WorkerLike
  ) {
    this.worker.on("failed", (job, err) => handleExhaustedJob(job, err, dlq));

    // Keep a reference so tests can verify handler registration
    void runner; // runner is used inside processWorkflowJob, passed at factory time
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

// ─── Production factory (excluded from unit-test coverage) ───────────────────

/* istanbul ignore next */
export function createWorkflowWorkerService(
  runner: WorkflowRunnerLike,
  dlq: IDLQueue,
  connection: Redis,
  concurrency: number
): WorkflowWorkerService {
  const worker = new Worker<WorkflowJobData>(
    WorkflowQueue.QUEUE_NAME,
    (job) => processWorkflowJob(job, runner),
    { connection, concurrency }
  );
  return new WorkflowWorkerService(
    runner,
    dlq,
    worker as unknown as WorkerLike
  );
}
