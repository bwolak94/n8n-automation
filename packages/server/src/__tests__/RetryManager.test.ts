import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { RetryManager } from "../engine/RetryManager.js";
import type { IDLQueue, FailedJob, RetryConfig } from "../engine/RetryManager.js";

class NetworkError extends Error {
  constructor() {
    super("network error");
    this.name = "NetworkError";
  }
}

class AuthError extends Error {
  constructor() {
    super("auth error");
    this.name = "AuthError";
  }
}

function makeDlq(): { dlq: IDLQueue; jobs: FailedJob[] } {
  const jobs: FailedJob[] = [];
  const dlq: IDLQueue = { add: async (job) => { jobs.push(job); } };
  return { dlq, jobs };
}

const jobContext = {
  nodeId: "node-1",
  executionId: "exec-1",
  tenantId: "tenant-1",
  payload: { input: "data" },
};

describe("RetryManager", () => {
  let sleepCalls: number[];
  let mockSleep: jest.MockedFunction<(ms: number) => Promise<void>>;

  beforeEach(() => {
    sleepCalls = [];
    mockSleep = jest.fn(async (ms: number) => {
      sleepCalls.push(ms);
    });
  });

  describe("successful execution", () => {
    it("returns the result without retrying on first success", async () => {
      const { dlq, jobs } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = { maxAttempts: 3, backoffStrategy: "fixed", backoffDelay: 100 };

      const result = await manager.execute(async () => "ok", config, jobContext);

      expect(result).toBe("ok");
      expect(mockSleep).not.toHaveBeenCalled();
      expect(jobs).toHaveLength(0);
    });
  });

  describe("exponential backoff", () => {
    it("sleeps with exponentially increasing delays between retries", async () => {
      const { dlq } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 4,
        backoffStrategy: "exponential",
        backoffDelay: 100,
      };

      let attempt = 0;
      await expect(
        manager.execute(async () => {
          attempt++;
          throw new Error("fail");
        }, config, jobContext)
      ).rejects.toThrow("fail");

      // delays for attempts 1, 2, 3 (not after the last)
      expect(sleepCalls).toEqual([100, 200, 400]); // 100*2^0, 100*2^1, 100*2^2
    });
  });

  describe("linear backoff", () => {
    it("sleeps with linearly increasing delays", async () => {
      const { dlq } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 4,
        backoffStrategy: "linear",
        backoffDelay: 50,
      };

      await expect(
        manager.execute(async () => { throw new Error("fail"); }, config, jobContext)
      ).rejects.toThrow();

      expect(sleepCalls).toEqual([50, 100, 150]); // 50*1, 50*2, 50*3
    });
  });

  describe("fixed backoff", () => {
    it("sleeps with constant delay", async () => {
      const { dlq } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 3,
        backoffStrategy: "fixed",
        backoffDelay: 200,
      };

      await expect(
        manager.execute(async () => { throw new Error("fail"); }, config, jobContext)
      ).rejects.toThrow();

      expect(sleepCalls).toEqual([200, 200]);
    });
  });

  describe("stops at maxAttempts", () => {
    it("calls fn exactly maxAttempts times then throws", async () => {
      const { dlq } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = { maxAttempts: 3, backoffStrategy: "fixed", backoffDelay: 0 };

      let callCount = 0;
      await expect(
        manager.execute(async () => {
          callCount++;
          throw new Error("persistent failure");
        }, config, jobContext)
      ).rejects.toThrow("persistent failure");

      expect(callCount).toBe(3);
    });

    it("succeeds on the last allowed attempt without going to DLQ", async () => {
      const { dlq, jobs } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = { maxAttempts: 3, backoffStrategy: "fixed", backoffDelay: 0 };

      let callCount = 0;
      const result = await manager.execute(async () => {
        callCount++;
        if (callCount < 3) throw new Error("transient");
        return "done";
      }, config, jobContext);

      expect(result).toBe("done");
      expect(jobs).toHaveLength(0);
    });
  });

  describe("moves to DLQ after exhausting attempts", () => {
    it("adds to DLQ with correct metadata", async () => {
      const { dlq, jobs } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = { maxAttempts: 2, backoffStrategy: "fixed", backoffDelay: 0 };

      await expect(
        manager.execute(async () => { throw new Error("boom"); }, config, jobContext)
      ).rejects.toThrow();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        nodeId: "node-1",
        executionId: "exec-1",
        tenantId: "tenant-1",
        attempts: 2,
      });
      expect(jobs[0].error.message).toBe("boom");
    });
  });

  describe("retryOn filter", () => {
    it("retries when error matches a retryOn class", async () => {
      const { dlq, jobs } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 3,
        backoffStrategy: "fixed",
        backoffDelay: 0,
        retryOn: [NetworkError],
      };

      let callCount = 0;
      await expect(
        manager.execute(async () => {
          callCount++;
          throw new NetworkError();
        }, config, jobContext)
      ).rejects.toBeInstanceOf(NetworkError);

      expect(callCount).toBe(3);
    });

    it("does NOT retry when error does not match retryOn — goes straight to DLQ", async () => {
      const { dlq, jobs } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 5,
        backoffStrategy: "fixed",
        backoffDelay: 0,
        retryOn: [NetworkError],
      };

      let callCount = 0;
      await expect(
        manager.execute(async () => {
          callCount++;
          throw new AuthError();
        }, config, jobContext)
      ).rejects.toBeInstanceOf(AuthError);

      expect(callCount).toBe(1); // no retries
      expect(jobs).toHaveLength(1);
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it("retries only matching types, stops on non-matching type mid-run", async () => {
      const { dlq } = makeDlq();
      const manager = new RetryManager(dlq, mockSleep);
      const config: RetryConfig = {
        maxAttempts: 5,
        backoffStrategy: "fixed",
        backoffDelay: 0,
        retryOn: [NetworkError],
      };

      let callCount = 0;
      await expect(
        manager.execute(async () => {
          callCount++;
          if (callCount <= 2) throw new NetworkError();
          throw new AuthError(); // non-retryable
        }, config, jobContext)
      ).rejects.toBeInstanceOf(AuthError);

      expect(callCount).toBe(3);
    });
  });
});
