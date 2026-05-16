import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";

// Mock @vue-flow/core so Handle renders as a plain div in tests
vi.mock("@vue-flow/core", () => ({
  Handle: defineComponent({
    name: "Handle",
    props: ["type", "position", "id"],
    template: '<div v-bind="$attrs" />',
  }),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import BaseNodeCard from "../BaseNodeCard.vue";

function mountCard(props: Record<string, unknown> = {}) {
  return mount(BaseNodeCard, {
    props: { label: "Test Node", ...props },
  });
}

describe("BaseNodeCard", () => {
  it("renders the node label", () => {
    const wrapper = mountCard({ label: "HTTP Request" });
    expect(wrapper.find("[data-testid='node-label']").text()).toBe("HTTP Request");
  });

  it("renders the icon when provided", () => {
    const wrapper = mountCard({ icon: "🌐" });
    expect(wrapper.find("[data-testid='node-icon']").text()).toBe("🌐");
  });

  it("does not render icon when not provided", () => {
    const wrapper = mountCard();
    expect(wrapper.find("[data-testid='node-icon']").exists()).toBe(false);
  });

  it("renders target and source handles", () => {
    const wrapper = mountCard();
    expect(wrapper.find("[data-testid='handle-target']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='handle-source']").exists()).toBe(true);
  });

  // ── Status badge variants ─────────────────────────────────────────────────

  it("renders idle status badge by default", () => {
    const wrapper = mountCard();
    expect(wrapper.find("[data-testid='status-badge-idle']").exists()).toBe(true);
  });

  it("renders running status badge", () => {
    const wrapper = mountCard({ status: "running" });
    const badge = wrapper.find("[data-testid='status-badge-running']");
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("bg-blue-500");
    expect(badge.classes()).toContain("animate-pulse");
  });

  it("renders success status badge", () => {
    const wrapper = mountCard({ status: "success" });
    const badge = wrapper.find("[data-testid='status-badge-success']");
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("bg-green-500");
  });

  it("renders error status badge", () => {
    const wrapper = mountCard({ status: "error" });
    const badge = wrapper.find("[data-testid='status-badge-error']");
    expect(badge.exists()).toBe(true);
    expect(badge.classes()).toContain("bg-red-500");
  });

  it("renders slot content", () => {
    const wrapper = mount(BaseNodeCard, {
      props: { label: "HTTP" },
      slots: { default: '<div data-testid="slot-content">extra</div>' },
    });
    expect(wrapper.find("[data-testid='slot-content']").exists()).toBe(true);
  });

  // ── Snapshot tests ─────────────────────────────────────────────────────────

  it("matches snapshot — idle", () => {
    const wrapper = mountCard({ label: "HTTP Request", icon: "🌐", status: "idle" });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — running", () => {
    const wrapper = mountCard({ label: "HTTP Request", icon: "🌐", status: "running" });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — success", () => {
    const wrapper = mountCard({ label: "HTTP Request", icon: "🌐", status: "success" });
    expect(wrapper.html()).toMatchSnapshot();
  });

  it("matches snapshot — error", () => {
    const wrapper = mountCard({ label: "HTTP Request", icon: "🌐", status: "error" });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
