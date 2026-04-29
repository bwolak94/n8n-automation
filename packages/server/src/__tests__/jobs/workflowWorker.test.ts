import { describe, expect, it, jest } from "@jest/globals";
import {
  processWorkflowJob,
  handleExhaustedJob,
  WorkflowWorkerService,
  type MinimalJob,
  type WorkerLike,
  type WorkflowRunnerLike,
} from "../../jobs/workers/workflowWorker.js";
import type { IDLQueue } from "../../engine/RetryManager.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRunner(): WorkflowRunnerLike & { run: jest.Mock } {
  return {
    run: jest.fn<WorkflowRunnerLike["run"]>().mockResolvedValue({ status: "completed" }),
  };
}

function makeDLQ(): IDLQueue & { add: jest.Mock } {
  return {
    add: jest.fn<IDLQueue["add"]>().mockResolvedValue(undefined),
  };
}

function makeWorker(): WorkerLike & { on: jest.Mock; close: jest.Mock } {
  return {
    on: jest.fn(),
    close: jest.fn<WorkerLike["close"]>().mockResolvedValue(undefined),
  };
}

function makeJob(
  overrides: Partial<MinimalJob> = {}
): MinimalJob {
  return {
    data: { workflowId: "wf-1", tenantId: "t-1", triggerData: { event: "test" } },
    opts: { attempts: 3 },
    attemptsMade: 3,
    ...overrides,
  };
}

// ─── processWorkflowJob ───────────────────────────────────────────────────────

describe("processWorkflowJob", () => {
  it("calls runner.run with workflowId, tenantId and triggerData", async () => {
    const runner = makeRunner();
    const job = makeJob();

    await processWorkflowJob(job, runner);

    expect(runner.run).toHaveBeenCalledWith("wf-1", "t-1", { event: "test" });
  });

  it("propagates errors thrown by runner.run", async () => {
    const runner = makeRunner();
    runner.run.mockRejectedValue(new Error("runner crashed"));
    const job = makeJob();

    await expect(processWorkflowJob(job, runner)).rejects.toThrow("runner crashed");
  });

  it("passes empty triggerData when none provided in job", async () => {
    const runner = makeRunner();
    const job = makeJob({
      data: { workflowId: "wf-2", tenantId: "t-2", triggerData: {} },
    });

    await processWorkflowJob(job, runner);

    expect(runner.run).toHaveBeenCalledWith("wf-2", "t-2", {});
  });
});

// ─── handleExhaustedJob ───────────────────────────────────────────────────────

describe("handleExhaustedJob", () => {
  it("adds to DLQ when attemptsMade equals attempts (exhausted)", async () => {
    const dlq = makeDLQ();
    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 3 });

    await handleExhaustedJob(job, new Error("final failure"), dlq);

    expect(dlq.add).toHaveBeenCalledTimes(1);
  });

  it("DLQ entry contains original job data, error, and retry count", async () => {
    const dlq = makeDLQ();
    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 3 });
    const err = new Error("something went wrong");

    await handleExhaustedJob(job, err, dlq);

    const entry = (dlq.add.mock.calls[0] as unknown[])[0] as {
      executionId: string;
      tenantId: string;
      error: Error;
      attempts: number;
      payload: unknown;
    };
    expect(entry.executionId).toBe("wf-1");
    expect(entry.tenantId).toBe("t-1");
    expect(entry.error).toBe(err);
    expect(entry.attempts).toBe(3);
    expect(entry.payload).toEqual(job.data);
  });

  it("does NOT add to DLQ when attemptsMade is less than attempts", async () => {
    const dlq = makeDLQ();
    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 2 });

    await handleExhaustedJob(job, new Error("transient"), dlq);

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it("does NOT add to DLQ when attemptsMade is zero", async () => {
    const dlq = makeDLQ();
    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 0 });

    await handleExhaustedJob(job, new Error("first fail"), dlq);

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it("defaults to maxAttempts=1 when opts.attempts is undefined", async () => {
    const dlq = makeDLQ();
    const job = makeJob({ opts: {}, attemptsMade: 1 });

    await handleExhaustedJob(job, new Error("boom"), dlq);

    expect(dlq.add).toHaveBeenCalled();
  });

  it("skips DLQ when job is undefined", async () => {
    const dlq = makeDLQ();

    await handleExhaustedJob(undefined, new Error("orphan"), dlq);

    expect(dlq.add).not.toHaveBeenCalled();
  });
});

// ─── WorkflowWorkerService ────────────────────────────────────────────────────

describe("WorkflowWorkerService", () => {
  it("registers a 'failed' event handler on the worker", () => {
    const runner = makeRunner();
    const dlq = makeDLQ();
    const worker = makeWorker();

    new WorkflowWorkerService(runner, dlq, worker);

    expect(worker.on).toHaveBeenCalledWith("failed", expect.any(Function));
  });

  it("failed handler triggers DLQ add when job is exhausted", async () => {
    const runner = makeRunner();
    const dlq = makeDLQ();
    const worker = makeWorker();

    new WorkflowWorkerService(runner, dlq, worker);

    // Extract the registered 'failed' handler
    const [, failedHandler] = worker.on.mock.calls[0] as [
      string,
      (job: MinimalJob | undefined, err: Error) => Promise<void>,
    ];

    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 3 });
    await failedHandler(job, new Error("exhausted"));

    expect(dlq.add).toHaveBeenCalledTimes(1);
  });

  it("failed handler does not add to DLQ for non-exhausted jobs", async () => {
    const runner = makeRunner();
    const dlq = makeDLQ();
    const worker = makeWorker();

    new WorkflowWorkerService(runner, dlq, worker);

    const [, failedHandler] = worker.on.mock.calls[0] as [
      string,
      (job: MinimalJob | undefined, err: Error) => Promise<void>,
    ];

    const job = makeJob({ opts: { attempts: 3 }, attemptsMade: 1 });
    await failedHandler(job, new Error("retry soon"));

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it("close delegates to worker.close", async () => {
    const runner = makeRunner();
    const dlq = makeDLQ();
    const worker = makeWorker();
    const service = new WorkflowWorkerService(runner, dlq, worker);

    await service.close();

    expect(worker.close).toHaveBeenCalledTimes(1);
  });
});
