import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { WaitNode } from "../../nodes/implementations/WaitNode.js";
import { isSuspendOutput } from "../../engine/SuspendSignal.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContext(): ExecutionContext {
  return {
    tenantId: "t-1",
    executionId: "exec-1",
    workflowId: "wf-1",
    variables: {},
  };
}

function cfg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { mode: "duration", maxWaitDays: 30, ...overrides };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WaitNode", () => {
  let node: WaitNode;

  beforeEach(() => {
    node = new WaitNode();
  });

  it("has correct type", () => {
    expect(node.definition.type).toBe("wait");
  });

  // ── Duration mode ────────────────────────────────────────────────────────────

  it("returns a suspend output for duration mode", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 5, unit: "seconds" } }), makeContext());
    expect(isSuspendOutput(result)).toBe(true);
  });

  it("computes correct delayMs for seconds", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 10, unit: "seconds" } }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(10_000);
  });

  it("computes correct delayMs for minutes", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 3, unit: "minutes" } }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(180_000);
  });

  it("computes correct delayMs for hours", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 2, unit: "hours" } }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(7_200_000);
  });

  it("computes correct delayMs for 2 days → 172800000 ms", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 2, unit: "days" } }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(172_800_000);
  });

  it("passes input through as data", async () => {
    const input = { orderId: "abc123" };
    const result = await node.execute(input, cfg({ duration: { value: 1, unit: "seconds" } }), makeContext());
    expect(result.data).toEqual(input);
  });

  it("includes resumeAfter ISO string in metadata", async () => {
    const before = Date.now();
    const result = await node.execute({}, cfg({ duration: { value: 60, unit: "seconds" } }), makeContext());
    const meta = (result.metadata as Record<string, Record<string, unknown>>)["__wait__"];
    const resumeAt = new Date(meta["resumeAfter"] as string).getTime();
    expect(resumeAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(resumeAt).toBeLessThan(before + 61_000);
  });

  it("throws WAIT_MISSING_DURATION when duration is absent", async () => {
    await expect(node.execute({}, cfg({ duration: undefined }), makeContext()))
      .rejects.toThrow("requires duration.value");
  });

  it("throws WAIT_INVALID_UNIT for unknown unit", async () => {
    await expect(node.execute({}, cfg({ duration: { value: 5, unit: "weeks" } }), makeContext()))
      .rejects.toThrow("unknown unit");
  });

  it("allows 0-second delay (immediate resume)", async () => {
    const result = await node.execute({}, cfg({ duration: { value: 0, unit: "seconds" } }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(0);
  });

  // ── until mode ──────────────────────────────────────────────────────────────

  it("computes positive delayMs for a future datetime", async () => {
    const future = new Date(Date.now() + 5_000).toISOString();
    const result = await node.execute({}, cfg({ mode: "until", until: future }), makeContext());
    const meta = (result.metadata as Record<string, Record<string, unknown>>)["__wait__"];
    const delay = meta["delayMs"] as number;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(5_000);
  });

  it("returns 0 delayMs for a past datetime (immediate resume)", async () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const result = await node.execute({}, cfg({ mode: "until", until: past }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"]).toBe(0);
  });

  it("throws WAIT_MISSING_UNTIL when until is absent", async () => {
    await expect(node.execute({}, cfg({ mode: "until" }), makeContext()))
      .rejects.toThrow("requires an 'until' datetime");
  });

  it("throws WAIT_INVALID_UNTIL for invalid datetime string", async () => {
    await expect(node.execute({}, cfg({ mode: "until", until: "not-a-date" }), makeContext()))
      .rejects.toThrow("invalid 'until' value");
  });

  it("sets mode='until' in metadata", async () => {
    const future = new Date(Date.now() + 1_000).toISOString();
    const result = await node.execute({}, cfg({ mode: "until", until: future }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["mode"]).toBe("until");
  });

  // ── webhook mode ─────────────────────────────────────────────────────────────

  it("sets delayMs to maxWaitDays * 86400000 for webhook mode", async () => {
    const result = await node.execute({}, cfg({ mode: "webhook", maxWaitDays: 7 }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["delayMs"])
      .toBe(7 * 86_400_000);
  });

  it("sets mode='webhook' in metadata", async () => {
    const result = await node.execute({}, cfg({ mode: "webhook" }), makeContext());
    expect((result.metadata as Record<string, Record<string, unknown>>)["__wait__"]["mode"]).toBe("webhook");
  });

  // ── maxWaitDays enforcement ───────────────────────────────────────────────────

  it("throws WAIT_EXCEEDS_MAX when delay exceeds maxWaitDays", async () => {
    const config = cfg({ duration: { value: 31, unit: "days" }, maxWaitDays: 30 });
    await expect(node.execute({}, config, makeContext())).rejects.toThrow("exceeds maxWaitDays");
  });

  it("allows delay exactly equal to maxWaitDays", async () => {
    const config = cfg({ duration: { value: 30, unit: "days" }, maxWaitDays: 30 });
    const result = await node.execute({}, config, makeContext());
    expect(isSuspendOutput(result)).toBe(true);
  });

  // ── unknown mode ──────────────────────────────────────────────────────────────

  it("throws WAIT_UNKNOWN_MODE for invalid mode", async () => {
    await expect(node.execute({}, cfg({ mode: "sleep" }), makeContext()))
      .rejects.toThrow("unknown mode");
  });
});
