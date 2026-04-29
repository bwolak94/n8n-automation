import { describe, expect, it, jest } from "@jest/globals";
import {
  BullMQDLQueue,
  type DLQJobData,
} from "../../jobs/queues/dlqQueue.js";
import type { QueueAdapter } from "../../jobs/queues/workflowQueue.js";
import type { FailedJob } from "../../engine/RetryManager.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQueue(): QueueAdapter<DLQJobData> & {
  add: jest.Mock;
  close: jest.Mock;
} {
  return {
    add: jest
      .fn<QueueAdapter<DLQJobData>["add"]>()
      .mockResolvedValue({ id: "dlq-1" }),
    close: jest.fn<QueueAdapter<DLQJobData>["close"]>().mockResolvedValue(undefined),
  };
}

const failedJob: FailedJob = {
  nodeId: "node-transform",
  executionId: "exec-abc",
  tenantId: "tenant-xyz",
  error: new Error("downstream timeout"),
  attempts: 3,
  payload: { input: "raw-data" },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BullMQDLQueue", () => {
  it("add calls queue.add with job name 'dlq'", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);

    await dlq.add(failedJob);

    expect(queue.add).toHaveBeenCalledWith(
      "dlq",
      expect.any(Object),
      expect.any(Object)
    );
  });

  it("maps FailedJob fields to DLQJobData correctly", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);

    await dlq.add(failedJob);

    const data = (queue.add.mock.calls[0] as unknown[])[1] as DLQJobData;
    expect(data.nodeId).toBe("node-transform");
    expect(data.executionId).toBe("exec-abc");
    expect(data.tenantId).toBe("tenant-xyz");
    expect(data.errorMessage).toBe("downstream timeout");
    expect(data.retryCount).toBe(3);
    expect(data.payload).toEqual({ input: "raw-data" });
  });

  it("DLQ entry includes a lastAttemptAt ISO timestamp", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);
    const before = new Date().toISOString();

    await dlq.add(failedJob);

    const data = (queue.add.mock.calls[0] as unknown[])[1] as DLQJobData;
    const after = new Date().toISOString();

    expect(data.lastAttemptAt >= before).toBe(true);
    expect(data.lastAttemptAt <= after).toBe(true);
  });

  it("passes removeOnFail: false and removeOnComplete: false in opts", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);

    await dlq.add(failedJob);

    const opts = (queue.add.mock.calls[0] as unknown[])[2] as {
      removeOnFail: boolean;
      removeOnComplete: boolean;
    };
    expect(opts.removeOnFail).toBe(false);
    expect(opts.removeOnComplete).toBe(false);
  });

  it("close delegates to queue.close", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);

    await dlq.close();

    expect(queue.close).toHaveBeenCalledTimes(1);
  });

  it("exposes correct QUEUE_NAME constant", () => {
    expect(BullMQDLQueue.QUEUE_NAME).toBe("workflow-dlq");
  });

  it("handles different error types — message is always a string", async () => {
    const queue = makeQueue();
    const dlq = new BullMQDLQueue(queue);

    await dlq.add({ ...failedJob, error: new TypeError("type mismatch") });

    const data = (queue.add.mock.calls[0] as unknown[])[1] as DLQJobData;
    expect(data.errorMessage).toBe("type mismatch");
  });
});
