import { describe, expect, it, jest } from "@jest/globals";
import {
  WorkflowQueue,
  type QueueAdapter,
  type WorkflowJobData,
} from "../../jobs/queues/workflowQueue.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueue(
  returnedId = "t-1:wf-1"
): QueueAdapter<WorkflowJobData> & {
  add: jest.Mock;
  close: jest.Mock;
} {
  return {
    add: jest
      .fn<QueueAdapter<WorkflowJobData>["add"]>()
      .mockResolvedValue({ id: returnedId }),
    close: jest.fn<QueueAdapter<WorkflowJobData>["close"]>().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowQueue", () => {
  it("enqueue passes correct job name and data to queue.add", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-1", { event: "trigger" }, "t-1");

    expect(queue.add).toHaveBeenCalledWith(
      "run",
      { workflowId: "wf-1", tenantId: "t-1", triggerData: { event: "trigger" } },
      expect.any(Object)
    );
  });

  it("enqueue returns the job id from queue.add", async () => {
    const queue = makeQueue("t-1:wf-1");
    const wq = new WorkflowQueue(queue);

    const id = await wq.enqueue("wf-1", {}, "t-1");

    expect(id).toBe("t-1:wf-1");
  });

  it("enqueue returns empty string when queue.add returns no id", async () => {
    const queue = makeQueue();
    (queue.add as jest.Mock).mockResolvedValue({});
    const wq = new WorkflowQueue(queue);

    const id = await wq.enqueue("wf-1", {}, "t-1");

    expect(id).toBe("");
  });

  // ── Deduplication key ──────────────────────────────────────────────────────

  it("enqueue sets jobId to tenantId:workflowId for deduplication", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-99", {}, "tenant-42");

    const opts = (queue.add.mock.calls[0] as unknown[])[2] as { jobId: string };
    expect(opts.jobId).toBe("tenant-42:wf-99");
  });

  it("same workflowId+tenantId always produces the same deduplication jobId", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-1", { a: 1 }, "t-1");
    await wq.enqueue("wf-1", { b: 2 }, "t-1");

    const opts0 = (queue.add.mock.calls[0] as unknown[])[2] as { jobId: string };
    const opts1 = (queue.add.mock.calls[1] as unknown[])[2] as { jobId: string };
    expect(opts0.jobId).toBe(opts1.jobId);
  });

  it("different workflowIds produce different jobIds", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-1", {}, "t-1");
    await wq.enqueue("wf-2", {}, "t-1");

    const opts0 = (queue.add.mock.calls[0] as unknown[])[2] as { jobId: string };
    const opts1 = (queue.add.mock.calls[1] as unknown[])[2] as { jobId: string };
    expect(opts0.jobId).not.toBe(opts1.jobId);
  });

  // ── Job options ────────────────────────────────────────────────────────────

  it("enqueue configures exponential backoff with 3 attempts", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-1", {}, "t-1");

    const opts = (queue.add.mock.calls[0] as unknown[])[2] as {
      attempts: number;
      backoff: { type: string; delay: number };
    };
    expect(opts.attempts).toBe(3);
    expect(opts.backoff.type).toBe("exponential");
    expect(opts.backoff.delay).toBe(1000);
  });

  it("enqueue sets removeOnComplete and removeOnFail correctly", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.enqueue("wf-1", {}, "t-1");

    const opts = (queue.add.mock.calls[0] as unknown[])[2] as {
      removeOnComplete: { count: number };
      removeOnFail: boolean;
    };
    expect(opts.removeOnComplete).toEqual({ count: 100 });
    expect(opts.removeOnFail).toBe(false);
  });

  // ── close ──────────────────────────────────────────────────────────────────

  it("close delegates to queue.close", async () => {
    const queue = makeQueue();
    const wq = new WorkflowQueue(queue);

    await wq.close();

    expect(queue.close).toHaveBeenCalledTimes(1);
  });

  // ── QUEUE_NAME ─────────────────────────────────────────────────────────────

  it("exposes correct QUEUE_NAME constant", () => {
    expect(WorkflowQueue.QUEUE_NAME).toBe("workflow-execution");
  });
});
