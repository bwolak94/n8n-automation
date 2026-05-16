import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import RecentExecutionsTable from "../RecentExecutionsTable.vue";
import type { RecentExecution } from "../../../../shared/types/index.js";

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
});

function makeExec(overrides: Partial<RecentExecution> = {}): RecentExecution {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    workflowName: "My Workflow",
    status: "completed",
    durationMs: 500,
    startedAt: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("RecentExecutionsTable", () => {
  it("shows skeleton when loading", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [], loading: true },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-testid='recent-executions-skeleton']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='recent-executions-empty']").exists()).toBe(false);
  });

  it("shows empty state when no executions and not loading", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [], loading: false },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-testid='recent-executions-empty']").exists()).toBe(true);
  });

  it("renders execution rows", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [makeExec(), makeExec({ id: "exec-2" })], loading: false },
      global: { plugins: [router] },
    });
    expect(wrapper.findAll("[data-testid='recent-execution-row']")).toHaveLength(2);
  });

  it("shows workflow name when provided", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [makeExec({ workflowName: "Send Report" })], loading: false },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-testid='recent-execution-row']").text()).toContain("Send Report");
  });

  it("falls back to workflowId when no workflow name", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: {
        executions: [makeExec({ workflowName: undefined, workflowId: "wf-abc" })],
        loading: false,
      },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-testid='recent-execution-row']").text()).toContain("wf-abc");
  });

  it("shows status badge", () => {
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [makeExec({ status: "failed" })], loading: false },
      global: { plugins: [router] },
    });
    expect(wrapper.find("[data-testid='recent-execution-row']").text()).toContain("failed");
  });

  it("navigates to workflow executions on row click", async () => {
    const pushSpy = vi.spyOn(router, "push");
    const wrapper = mount(RecentExecutionsTable, {
      props: { executions: [makeExec({ workflowId: "wf-99" })], loading: false },
      global: { plugins: [router] },
    });
    await wrapper.find("[data-testid='recent-execution-row']").trigger("click");
    expect(pushSpy).toHaveBeenCalledWith("/workflows/wf-99/executions");
  });
});
