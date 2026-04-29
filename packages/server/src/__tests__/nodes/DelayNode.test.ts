import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DelayNode } from "../../nodes/implementations/DelayNode.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const node = new DelayNode();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DelayNode", () => {
  it("has correct definition type", () => {
    expect(node.definition.type).toBe("delay");
  });

  // ── Timer resolution ────────────────────────────────────────────────────

  describe("with fake timers", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("resolves after delay in ms and returns delayedMs + resumedAt", async () => {
      const promise = node.execute({}, { duration: 500, unit: "ms" }, ctx);
      jest.runAllTimers();

      const output = await promise;
      const data = output.data as { delayedMs: number; resumedAt: string };
      expect(data.delayedMs).toBe(500);
      expect(typeof data.resumedAt).toBe("string");
    });

    it("converts seconds to milliseconds", async () => {
      const promise = node.execute({}, { duration: 2, unit: "s" }, ctx);
      jest.runAllTimers();
      const output = await promise;
      expect((output.data as { delayedMs: number }).delayedMs).toBe(2000);
    });

    it("converts minutes to milliseconds", async () => {
      const promise = node.execute({}, { duration: 1, unit: "m" }, ctx);
      jest.runAllTimers();
      const output = await promise;
      expect((output.data as { delayedMs: number }).delayedMs).toBe(60_000);
    });

    it("converts hours to milliseconds", async () => {
      const promise = node.execute({}, { duration: 1, unit: "h" }, ctx);
      jest.runAllTimers();
      const output = await promise;
      expect((output.data as { delayedMs: number }).delayedMs).toBe(3_600_000);
    });

    it("defaults unit to ms when not specified", async () => {
      const promise = node.execute({}, { duration: 250 }, ctx);
      jest.runAllTimers();
      const output = await promise;
      expect((output.data as { delayedMs: number }).delayedMs).toBe(250);
    });
  });

  // ── AbortSignal ─────────────────────────────────────────────────────────

  it("rejects when AbortSignal is aborted after creation", async () => {
    const controller = new AbortController();
    const abortCtx: ExecutionContext = { ...ctx, signal: controller.signal };

    const promise = node.execute({}, { duration: 30_000, unit: "ms" }, abortCtx);
    controller.abort();

    await expect(promise).rejects.toThrow("Delay cancelled");
  });

  it("rejects immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortCtx: ExecutionContext = { ...ctx, signal: controller.signal };

    await expect(
      node.execute({}, { duration: 100, unit: "ms" }, abortCtx)
    ).rejects.toThrow("Delay cancelled");
  });

  // ── Error cases ─────────────────────────────────────────────────────────

  it("throws AppError for unknown time unit", async () => {
    await expect(
      node.execute({}, { duration: 1, unit: "years" }, ctx)
    ).rejects.toThrow("Unknown time unit: years");
  });

  it("throws AppError when duration is missing", async () => {
    await expect(node.execute({}, {}, ctx)).rejects.toThrow(
      "DelayNode requires a duration"
    );
  });
});
