import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ExecutionStepRow from "../ExecutionStepRow.vue";
import type { ExecutionStep } from "../../../../shared/types/index.js";

function makeStep(overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return {
    id: "step-1",
    executionId: "exec-1",
    nodeId: "node-1",
    nodeType: "HttpRequest",
    status: "success",
    attempt: 1,
    durationMs: 250,
    ...overrides,
  };
}

describe("ExecutionStepRow", () => {
  it("renders the node type", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep() } });
    expect(wrapper.get("[data-testid='step-node-type']").text()).toBe("HttpRequest");
  });

  it("shows duration in ms when < 1000", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ durationMs: 250 }) } });
    expect(wrapper.get("[data-testid='step-duration']").text()).toBe("250ms");
  });

  it("shows duration in seconds when >= 1000", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ durationMs: 2500 }) } });
    expect(wrapper.get("[data-testid='step-duration']").text()).toBe("2.50s");
  });

  it("shows spinner icon for running status", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ status: "running" }) } });
    expect(wrapper.find("[data-testid='step-icon-running']").exists()).toBe(true);
  });

  it("shows check icon for success status", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ status: "success" }) } });
    expect(wrapper.find("[data-testid='step-icon-success']").exists()).toBe(true);
  });

  it("shows check icon for completed status", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ status: "completed" }) } });
    expect(wrapper.find("[data-testid='step-icon-completed']").exists()).toBe(true);
  });

  it("shows error icon for failed status", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ status: "failed" }) } });
    expect(wrapper.find("[data-testid='step-icon-failed']").exists()).toBe(true);
  });

  it("shows dash icon for skipped status", () => {
    const wrapper = mount(ExecutionStepRow, { props: { step: makeStep({ status: "skipped" }) } });
    expect(wrapper.find("[data-testid='step-icon-skipped']").exists()).toBe(true);
  });

  it("shows error message when step has error", () => {
    const wrapper = mount(ExecutionStepRow, {
      props: { step: makeStep({ status: "failed", error: "Connection refused" }) },
    });
    expect(wrapper.get("[data-testid='step-error']").text()).toBe("Connection refused");
  });

  it("does not show JSON viewer by default", () => {
    const step = { ...makeStep(), input: { foo: "bar" }, output: { result: 42 } } as unknown as ExecutionStep;
    const wrapper = mount(ExecutionStepRow, { props: { step } });
    expect(wrapper.find("[data-testid='step-json-viewer']").exists()).toBe(false);
  });

  it("expands JSON viewer on click when step has input/output", async () => {
    const step = { ...makeStep(), input: { foo: "bar" }, output: { result: 42 } } as unknown as ExecutionStep;
    const wrapper = mount(ExecutionStepRow, { props: { step } });
    await wrapper.find("[role='button']").trigger("click");
    expect(wrapper.find("[data-testid='step-json-viewer']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='step-input']").text()).toContain("foo");
    expect(wrapper.find("[data-testid='step-output']").text()).toContain("result");
  });
});
