import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import DlqPanel from "../DlqPanel.vue";
import type { DlqEntry } from "../../../../shared/types/index.js";

const mockRetry = vi.fn();
const mockDiscard = vi.fn();
const mockDlqQuery = vi.fn();

vi.mock("../../../../shared/queries/useQueue.js", () => ({
  useDlqQuery: () => mockDlqQuery(),
  useRetryDlqJob: () => ({ mutate: mockRetry, isPending: ref(false) }),
  useDiscardDlqJob: () => ({ mutate: mockDiscard, isPending: ref(false) }),
}));

function makeDlqEntry(overrides: Partial<DlqEntry> = {}): DlqEntry {
  return {
    id: "job-1",
    data: { workflowName: "Test Workflow" },
    errorMessage: "Connection timeout",
    retryCount: 3,
    failedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("DlqPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while fetching", () => {
    mockDlqQuery.mockReturnValue({ data: ref(null), isPending: ref(true), isError: ref(false) });
    const wrapper = mount(DlqPanel);
    expect(wrapper.find("[data-testid='dlq-loading']").exists()).toBe(true);
  });

  it("shows empty state when no entries", async () => {
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [], total: 0, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='dlq-empty']").exists()).toBe(true);
  });

  it("renders DLQ entries", async () => {
    const entries = [makeDlqEntry(), makeDlqEntry({ id: "job-2", errorMessage: "Timeout" })];
    mockDlqQuery.mockReturnValue({
      data: ref({ items: entries, total: 2, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel);
    await flushPromises();
    expect(wrapper.findAll("[data-testid='dlq-entry']")).toHaveLength(2);
  });

  it("shows workflow name from entry data", async () => {
    const entry = makeDlqEntry({ data: { workflowName: "My Workflow" } });
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='dlq-workflow-name']").text()).toBe("My Workflow");
  });

  it("shows error message", async () => {
    const entry = makeDlqEntry({ errorMessage: "Connection refused" });
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel);
    await flushPromises();
    expect(wrapper.find("[data-testid='dlq-error']").text()).toBe("Connection refused");
  });

  it("calls retry mutate when retry button clicked", async () => {
    const entry = makeDlqEntry({ id: "job-99" });
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel);
    await flushPromises();
    await wrapper.find("[data-testid='dlq-retry-btn']").trigger("click");
    expect(mockRetry).toHaveBeenCalledWith("job-99");
  });

  it("shows confirmation dialog when discard button clicked", async () => {
    const entry = makeDlqEntry();
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel, { attachTo: document.body });
    await flushPromises();
    await wrapper.find("[data-testid='dlq-discard-btn']").trigger("click");
    await flushPromises();
    expect(document.querySelector("[data-testid='discard-confirm-dialog']")).toBeTruthy();
    wrapper.unmount();
  });

  it("calls discard mutate after confirm", async () => {
    const entry = makeDlqEntry({ id: "job-77" });
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel, { attachTo: document.body });
    await flushPromises();
    // Click discard → opens dialog
    await wrapper.find("[data-testid='dlq-discard-btn']").trigger("click");
    await flushPromises();
    // Confirm
    const confirmBtn = document.querySelector("[data-testid='discard-confirm']") as HTMLElement;
    confirmBtn.click();
    await flushPromises();
    expect(mockDiscard).toHaveBeenCalledWith("job-77", expect.any(Object));
    wrapper.unmount();
  });

  it("does not call discard when cancel is clicked in dialog", async () => {
    const entry = makeDlqEntry();
    mockDlqQuery.mockReturnValue({
      data: ref({ items: [entry], total: 1, limit: 20, offset: 0 }),
      isPending: ref(false),
      isError: ref(false),
    });
    const wrapper = mount(DlqPanel, { attachTo: document.body });
    await flushPromises();
    await wrapper.find("[data-testid='dlq-discard-btn']").trigger("click");
    await flushPromises();
    const cancelBtn = document.querySelector("[data-testid='discard-cancel']") as HTMLElement;
    cancelBtn.click();
    await flushPromises();
    expect(mockDiscard).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
