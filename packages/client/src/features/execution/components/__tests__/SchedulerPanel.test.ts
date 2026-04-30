import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import SchedulerPanel from "../SchedulerPanel.vue";

const mockUpdateWorkflow = vi.fn();

vi.mock("../../../../shared/queries/useWorkflows.js", () => ({
  useUpdateWorkflow: () => ({
    mutate: mockUpdateWorkflow,
    isPending: ref(false),
  }),
}));

describe("SchedulerPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the cron input", () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    expect(wrapper.find("[data-testid='cron-input']").exists()).toBe(true);
  });

  it("shows human-readable description for valid cron: every Monday at 09:00", async () => {
    const wrapper = mount(SchedulerPanel, {
      props: { workflowId: "wf-1", initialSchedule: { enabled: true, cronExpression: "0 9 * * 1", timezone: "UTC" } },
    });
    await flushPromises();
    expect(wrapper.find("[data-testid='cron-description']").text()).toBe("Every Monday at 09:00");
  });

  it("shows human-readable description: every day at 08:30", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    const input = wrapper.find<HTMLInputElement>("[data-testid='cron-input']");
    await input.setValue("30 8 * * *");
    await flushPromises();
    expect(wrapper.find("[data-testid='cron-description']").text()).toBe("Every day at 08:30");
  });

  it("shows error for invalid cron expression", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    const input = wrapper.find<HTMLInputElement>("[data-testid='cron-input']");
    await input.setValue("invalid cron");
    await flushPromises();
    expect(wrapper.find("[data-testid='cron-error']").exists()).toBe(true);
  });

  it("shows error for wrong field count", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    const input = wrapper.find<HTMLInputElement>("[data-testid='cron-input']");
    await input.setValue("* * *");
    await flushPromises();
    expect(wrapper.find("[data-testid='cron-error']").text()).toContain("5 fields");
  });

  it("disables save button when cron is invalid", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    const input = wrapper.find<HTMLInputElement>("[data-testid='cron-input']");
    await input.setValue("not valid");
    await flushPromises();
    const btn = wrapper.find<HTMLButtonElement>("[data-testid='scheduler-save-btn']");
    expect(btn.element.disabled).toBe(true);
  });

  it("calls updateWorkflow with schedule on save", async () => {
    const wrapper = mount(SchedulerPanel, {
      props: {
        workflowId: "wf-42",
        initialSchedule: { enabled: true, cronExpression: "0 9 * * 1", timezone: "UTC" },
      },
    });
    await flushPromises();
    await wrapper.find("[data-testid='scheduler-save-btn']").trigger("click");
    expect(mockUpdateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wf-42",
        data: expect.objectContaining({
          schedule: expect.objectContaining({
            cronExpression: "0 9 * * 1",
            enabled: true,
            timezone: "UTC",
          }),
        }),
      }),
      expect.any(Object)
    );
  });

  it("toggles enabled state", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    const toggleBtn = wrapper.find("[data-testid='scheduler-toggle-btn']");
    // Initially disabled
    expect(toggleBtn.attributes("aria-checked")).toBe("false");
    await toggleBtn.trigger("click");
    expect(toggleBtn.attributes("aria-checked")).toBe("true");
  });

  it("renders timezone selector", () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    expect(wrapper.find("[data-testid='timezone-select']").exists()).toBe(true);
  });

  it("updates fields when initialSchedule prop changes", async () => {
    const wrapper = mount(SchedulerPanel, { props: { workflowId: "wf-1" } });
    await wrapper.setProps({
      workflowId: "wf-1",
      initialSchedule: { enabled: true, cronExpression: "0 6 * * 5", timezone: "Europe/Warsaw" },
    });
    await flushPromises();
    const input = wrapper.find<HTMLInputElement>("[data-testid='cron-input']");
    expect(input.element.value).toBe("0 6 * * 5");
  });

  it("emits saved event on successful save", async () => {
    mockUpdateWorkflow.mockImplementation((_payload: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    const wrapper = mount(SchedulerPanel, {
      props: {
        workflowId: "wf-emit",
        initialSchedule: { enabled: true, cronExpression: "0 9 * * 1", timezone: "UTC" },
      },
    });
    await flushPromises();
    await wrapper.find("[data-testid='scheduler-save-btn']").trigger("click");
    expect(wrapper.emitted("saved")).toBeTruthy();
  });
});
