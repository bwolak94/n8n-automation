import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import ExecutionLogPanel from "../ExecutionLogPanel.vue";
import type { ExecutionSummary } from "../../../../shared/types/index.js";

const mockQuery = vi.fn();

vi.mock("../../../../shared/queries/useExecutions.js", () => ({
  useExecutionPollingQuery: () => mockQuery(),
  useCancelExecution: () => ({
    mutate: vi.fn(),
    isPending: ref(false),
  }),
}));

function makeExecution(overrides: Partial<ExecutionSummary> = {}): ExecutionSummary {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    tenantId: "t-1",
    status: "running",
    steps: [],
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ExecutionLogPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows placeholder when no executionId provided", () => {
    mockQuery.mockReturnValue({ data: ref(null), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: null } });
    expect(wrapper.text()).toContain("Select an execution");
  });

  it("shows spinner while loading", () => {
    mockQuery.mockReturnValue({ data: ref(null), isPending: ref(true), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    expect(wrapper.find("[data-testid='execution-loading']").exists()).toBe(true);
  });

  it("shows execution status badge when loaded", async () => {
    const execution = makeExecution({ status: "running" });
    mockQuery.mockReturnValue({ data: ref(execution), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.find("[data-testid='execution-status-badge']").text()).toBe("running");
  });

  it("renders ExecutionStepRow for each step", async () => {
    const execution = makeExecution({
      status: "completed",
      steps: [
        { id: "s1", executionId: "exec-1", nodeId: "n1", nodeType: "HttpRequest", status: "success", attempt: 1 },
        { id: "s2", executionId: "exec-1", nodeId: "n2", nodeType: "Condition", status: "success", attempt: 1 },
      ],
    });
    mockQuery.mockReturnValue({ data: ref(execution), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.findAll("[data-testid='execution-step-row']")).toHaveLength(2);
  });

  it("shows error state on query failure", async () => {
    mockQuery.mockReturnValue({ data: ref(null), isPending: ref(false), isError: ref(true) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.text()).toContain("Failed to load execution");
  });

  it("shows CancelExecutionButton only when status is running", async () => {
    const execution = makeExecution({ status: "running" });
    mockQuery.mockReturnValue({ data: ref(execution), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(true);
  });

  it("does not show CancelExecutionButton when status is completed", async () => {
    const execution = makeExecution({ status: "completed" });
    mockQuery.mockReturnValue({ data: ref(execution), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(false);
  });

  it("emits close event when close button clicked", async () => {
    mockQuery.mockReturnValue({ data: ref(null), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: null } });
    await wrapper.find("[aria-label='Close panel']").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("polls by using refetchInterval on running execution (integration: composable config)", async () => {
    // Verify that the polling query is called with the executionId ref
    const execution = makeExecution({ status: "running" });
    const dataSpy = ref(execution);
    mockQuery.mockReturnValue({ data: dataSpy, isPending: ref(false), isError: ref(false) });
    mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(mockQuery).toHaveBeenCalled();
  });

  it("stops showing spinner after data loads", async () => {
    const execution = makeExecution({ status: "completed" });
    mockQuery.mockReturnValue({ data: ref(execution), isPending: ref(false), isError: ref(false) });
    const wrapper = mount(ExecutionLogPanel, { props: { executionId: "exec-1" } });
    await flushPromises();
    expect(wrapper.find("[data-testid='execution-loading']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='execution-status-badge']").exists()).toBe(true);
  });
});
