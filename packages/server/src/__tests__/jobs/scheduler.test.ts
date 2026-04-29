import { describe, expect, it, jest } from "@jest/globals";
import {
  WorkflowScheduler,
  type CronFactory,
  type CronTask,
  type ScheduledWorkflow,
} from "../../jobs/scheduler.js";
import type { WorkflowQueue } from "../../jobs/queues/workflowQueue.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueue(): Pick<WorkflowQueue, "enqueue" | "close"> & {
  enqueue: jest.Mock;
} {
  return {
    enqueue: jest
      .fn<WorkflowQueue["enqueue"]>()
      .mockResolvedValue("job-1"),
    close: jest.fn<WorkflowQueue["close"]>().mockResolvedValue(undefined),
  };
}

function makeCronTask(): CronTask & { stop: jest.Mock } {
  return { stop: jest.fn() };
}

type CapturedCallback = () => void | Promise<void>;

/**
 * Returns a CronFactory that:
 * - creates a new mock CronTask per call
 * - stores the last registered callback for direct invocation in tests
 */
function makeCronFactory(): {
  factory: CronFactory;
  tasks: Array<CronTask & { stop: jest.Mock }>;
  lastCallback: () => CapturedCallback;
} {
  const tasks: Array<CronTask & { stop: jest.Mock }> = [];
  const callbacks: CapturedCallback[] = [];

  const factory = jest.fn<CronFactory>().mockImplementation((_expr, cb) => {
    callbacks.push(cb);
    const task = makeCronTask();
    tasks.push(task);
    return task;
  });

  return {
    factory,
    tasks,
    lastCallback: () => callbacks[callbacks.length - 1],
  };
}

const wf1: ScheduledWorkflow = {
  workflowId: "wf-1",
  tenantId: "t-1",
  cronExpression: "0 * * * *",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowScheduler", () => {
  // ── addWorkflow ─────────────────────────────────────────────────────────────

  describe("addWorkflow", () => {
    it("creates a cron task with the provided expression", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);

      expect(factory).toHaveBeenCalledWith(
        "0 * * * *",
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("passes scheduled: true to cron factory", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);

      const opts = (factory.mock.calls[0] as unknown[])[2] as {
        scheduled: boolean;
      };
      expect(opts.scheduled).toBe(true);
    });

    it("passes timezone when provided", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow({ ...wf1, timezone: "America/New_York" });

      const opts = (factory.mock.calls[0] as unknown[])[2] as {
        timezone?: string;
      };
      expect(opts.timezone).toBe("America/New_York");
    });

    it("increments activeCount after adding a workflow", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);

      expect(scheduler.activeCount).toBe(1);
    });

    it("replacing an existing workflow stops old task and creates new one", () => {
      const { factory, tasks } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow({ ...wf1, cronExpression: "* * * * *" });
      scheduler.addWorkflow({ ...wf1, cronExpression: "0 */2 * * *" });

      expect(tasks[0].stop).toHaveBeenCalled();
      expect(scheduler.activeCount).toBe(1);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("multiple distinct workflows are tracked independently", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      scheduler.addWorkflow({ ...wf1, workflowId: "wf-2", cronExpression: "*/5 * * * *" });

      expect(scheduler.activeCount).toBe(2);
    });
  });

  // ── cron callback ───────────────────────────────────────────────────────────

  describe("cron callback", () => {
    it("fires workflowQueue.enqueue when the cron triggers", async () => {
      const queue = makeQueue();
      const { factory, lastCallback } = makeCronFactory();
      const scheduler = new WorkflowScheduler(queue as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      await lastCallback()();

      expect(queue.enqueue).toHaveBeenCalledWith("wf-1", {}, "t-1");
    });

    it("enqueue call passes an empty triggerData object", async () => {
      const queue = makeQueue();
      const { factory, lastCallback } = makeCronFactory();
      const scheduler = new WorkflowScheduler(queue as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      await lastCallback()();

      const [, triggerData] = queue.enqueue.mock.calls[0] as [
        string,
        Record<string, unknown>,
        string,
      ];
      expect(triggerData).toEqual({});
    });
  });

  // ── removeWorkflow ──────────────────────────────────────────────────────────

  describe("removeWorkflow", () => {
    it("stops the cron task for the given workflowId", () => {
      const { factory, tasks } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      scheduler.removeWorkflow("wf-1");

      expect(tasks[0].stop).toHaveBeenCalled();
    });

    it("decrements activeCount after removal", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      scheduler.removeWorkflow("wf-1");

      expect(scheduler.activeCount).toBe(0);
    });

    it("is a no-op when workflowId is not registered", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      // Should not throw
      expect(() => scheduler.removeWorkflow("unknown-wf")).not.toThrow();
    });
  });

  // ── stopAll ─────────────────────────────────────────────────────────────────

  describe("stopAll", () => {
    it("stops all registered cron tasks", () => {
      const { factory, tasks } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      scheduler.addWorkflow({ ...wf1, workflowId: "wf-2" });
      scheduler.stopAll();

      expect(tasks[0].stop).toHaveBeenCalled();
      expect(tasks[1].stop).toHaveBeenCalled();
    });

    it("resets activeCount to zero", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      scheduler.addWorkflow(wf1);
      scheduler.addWorkflow({ ...wf1, workflowId: "wf-2" });
      scheduler.stopAll();

      expect(scheduler.activeCount).toBe(0);
    });

    it("stopAll on empty scheduler does not throw", () => {
      const { factory } = makeCronFactory();
      const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

      expect(() => scheduler.stopAll()).not.toThrow();
    });
  });

  // ── activeCount ─────────────────────────────────────────────────────────────

  it("activeCount starts at 0", () => {
    const { factory } = makeCronFactory();
    const scheduler = new WorkflowScheduler(makeQueue() as WorkflowQueue, factory);

    expect(scheduler.activeCount).toBe(0);
  });
});
