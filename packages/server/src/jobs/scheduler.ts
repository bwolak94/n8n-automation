import cron from "node-cron";
import type { WorkflowQueue } from "./queues/workflowQueue.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduledWorkflow {
  readonly workflowId: string;
  readonly tenantId: string;
  readonly cronExpression: string;
  readonly timezone?: string;
}

export interface CronTask {
  stop(): void;
}

/**
 * Injectable cron factory — default is `cron.schedule`, overridden in tests.
 */
export type CronFactory = (
  expression: string,
  callback: () => void | Promise<void>,
  options?: { timezone?: string; scheduled?: boolean }
) => CronTask;

// ─── WorkflowScheduler ────────────────────────────────────────────────────────

/**
 * In-memory cron scheduler for active workflows.
 *
 * On service startup, call `addWorkflow()` for each active scheduled workflow
 * loaded from the DB. State is ephemeral — it is rebuilt on every restart.
 */
export class WorkflowScheduler {
  private readonly tasks = new Map<string, CronTask>();

  constructor(
    private readonly workflowQueue: WorkflowQueue,
    private readonly cronFactory: CronFactory = cron.schedule
  ) {}

  /**
   * Register a workflow's cron schedule.
   * If the workflow is already registered, the existing task is replaced.
   */
  addWorkflow(workflow: ScheduledWorkflow): void {
    this.removeWorkflow(workflow.workflowId);

    const task = this.cronFactory(
      workflow.cronExpression,
      async () => {
        await this.workflowQueue.enqueue(
          workflow.workflowId,
          {},
          workflow.tenantId
        );
      },
      { timezone: workflow.timezone, scheduled: true }
    );

    this.tasks.set(workflow.workflowId, task);
  }

  /**
   * Stop and unregister a workflow's cron task.
   * No-op if the workflow is not registered.
   */
  removeWorkflow(workflowId: string): void {
    const task = this.tasks.get(workflowId);
    if (task) {
      task.stop();
      this.tasks.delete(workflowId);
    }
  }

  /** Stop all cron tasks (e.g. on graceful shutdown). */
  stopAll(): void {
    for (const workflowId of [...this.tasks.keys()]) {
      this.removeWorkflow(workflowId);
    }
  }

  /** Number of currently active scheduled workflows. */
  get activeCount(): number {
    return this.tasks.size;
  }
}
