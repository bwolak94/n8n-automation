import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import CancelExecutionButton from "../CancelExecutionButton.vue";

const mockMutate = vi.fn();

vi.mock("../../../../shared/queries/useExecutions.js", () => ({
  useCancelExecution: () => ({
    mutate: mockMutate,
    isPending: ref(false),
  }),
}));

describe("CancelExecutionButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the cancel button when status is running", () => {
    const wrapper = mount(CancelExecutionButton, {
      props: { executionId: "exec-1", status: "running" },
    });
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(true);
  });

  it("does NOT render when status is completed", () => {
    const wrapper = mount(CancelExecutionButton, {
      props: { executionId: "exec-1", status: "completed" },
    });
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(false);
  });

  it("does NOT render when status is failed", () => {
    const wrapper = mount(CancelExecutionButton, {
      props: { executionId: "exec-1", status: "failed" },
    });
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(false);
  });

  it("does NOT render when status is cancelled", () => {
    const wrapper = mount(CancelExecutionButton, {
      props: { executionId: "exec-1", status: "cancelled" },
    });
    expect(wrapper.find("[data-testid='cancel-execution-btn']").exists()).toBe(false);
  });

  it("calls cancel mutate with executionId on click", async () => {
    const wrapper = mount(CancelExecutionButton, {
      props: { executionId: "exec-42", status: "running" },
    });

    await wrapper.get("[data-testid='cancel-execution-btn']").trigger("click");
    await flushPromises();

    expect(mockMutate).toHaveBeenCalledWith("exec-42", expect.any(Object));
  });
});
