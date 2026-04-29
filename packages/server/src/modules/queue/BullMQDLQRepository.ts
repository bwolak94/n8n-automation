import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { DLQEntry, IDLQRepository } from "./IDLQRepository.js";
import type { DLQJobData } from "../../jobs/queues/dlqQueue.js";
import { BullMQDLQueue } from "../../jobs/queues/dlqQueue.js";

// ─── BullMQ-backed IDLQRepository ────────────────────────────────────────────

export class BullMQDLQRepository implements IDLQRepository {
  constructor(private readonly queue: Queue<DLQJobData>) {}

  async list(offset: number, limit: number): Promise<{ items: DLQEntry[]; total: number }> {
    // BullMQ stores unprocessed DLQ jobs as "waiting" state
    const [waiting, delayed, failed] = await Promise.all([
      this.queue.getJobs(["waiting"], offset, offset + limit - 1),
      this.queue.getJobs(["delayed"], offset, offset + limit - 1),
      this.queue.getJobs(["failed"], offset, offset + limit - 1),
    ]);

    const allJobs = [...waiting, ...delayed, ...failed];
    const paginated = allJobs.slice(0, limit);

    const items: DLQEntry[] = paginated
      .filter((job) => job.id !== undefined)
      .map((job) => ({
        id: job.id!,
        data: job.data,
        errorMessage: job.data.errorMessage ?? job.failedReason ?? "Unknown error",
        retryCount: job.data.retryCount ?? (job.attemptsMade ?? 0),
        failedAt: new Date(job.data.lastAttemptAt ?? job.processedOn ?? Date.now()),
      }));

    const total = await this.queue.count();

    return { items, total };
  }

  async retry(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new Error(`DLQ job '${jobId}' not found`);
    await job.retry("failed");
  }

  async discard(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new Error(`DLQ job '${jobId}' not found`);
    await job.remove();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/* istanbul ignore next */
export function createBullMQDLQRepository(connection: Redis): BullMQDLQRepository {
  const queue = new Queue<DLQJobData>(BullMQDLQueue.QUEUE_NAME, { connection });
  return new BullMQDLQRepository(queue);
}
