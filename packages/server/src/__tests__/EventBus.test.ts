import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { EventBus } from "../engine/EventBus.js";
import type { StepStartedEvent } from "../engine/EventBus.js";

const stepStartedPayload: StepStartedEvent = {
  executionId: "exec-1",
  workflowId: "wf-1",
  tenantId: "t-1",
  nodeId: "n1",
  nodeType: "http",
  startedAt: new Date(),
};

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("calls registered handler when event is emitted", async () => {
    const handler = jest.fn();
    bus.on("step.started", handler);
    await bus.emit("step.started", stepStartedPayload);
    expect(handler).toHaveBeenCalledWith(stepStartedPayload);
  });

  it("calls all registered handlers for the same event", async () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on("step.started", h1);
    bus.on("step.started", h2);
    await bus.emit("step.started", stepStartedPayload);
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("does not call handlers for a different event type", async () => {
    const handler = jest.fn();
    bus.on("step.completed", handler);
    await bus.emit("step.started", stepStartedPayload);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler after off() removes it", async () => {
    const handler = jest.fn();
    bus.on("step.started", handler);
    bus.off("step.started", handler);
    await bus.emit("step.started", stepStartedPayload);
    expect(handler).not.toHaveBeenCalled();
  });

  it("off() is a no-op when event has no listeners", () => {
    const handler = jest.fn();
    expect(() => bus.off("step.started", handler)).not.toThrow();
  });

  it("off() only removes the specified handler, leaving others intact", async () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.on("step.started", h1);
    bus.on("step.started", h2);
    bus.off("step.started", h1);
    await bus.emit("step.started", stepStartedPayload);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("awaits async handlers", async () => {
    const order: number[] = [];
    bus.on("step.started", async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
      order.push(1);
    });
    bus.on("step.started", async () => {
      order.push(2);
    });
    await bus.emit("step.started", stepStartedPayload);
    expect(order).toContain(1);
    expect(order).toContain(2);
  });

  it("emits all engine event types without error", async () => {
    const now = new Date();
    const base = { executionId: "e", workflowId: "w", tenantId: "t" };
    const stepBase = { ...base, nodeId: "n", nodeType: "http" };

    await bus.emit("execution.started", { ...base, startedAt: now });
    await bus.emit("execution.completed", { ...base, completedAt: now, outputs: {} });
    await bus.emit("execution.failed", { ...base, failedAt: now, error: new Error("x") });
    await bus.emit("step.started", { ...stepBase, startedAt: now });
    await bus.emit("step.completed", { ...stepBase, completedAt: now, output: { data: null } });
    await bus.emit("step.failed", { ...stepBase, failedAt: now, error: new Error("y") });
  });
});
