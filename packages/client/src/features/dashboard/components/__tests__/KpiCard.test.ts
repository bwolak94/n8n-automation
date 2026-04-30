import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import KpiCard from "../KpiCard.vue";

describe("KpiCard", () => {
  it("renders label and value", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Total Workflows", value: 42, icon: "⚡" },
    });
    expect(wrapper.get("[data-testid='kpi-value']").text()).toBe("42");
    expect(wrapper.text()).toContain("Total Workflows");
  });

  it("renders string value", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Success Rate", value: "98.5%", icon: "✓" },
    });
    expect(wrapper.get("[data-testid='kpi-value']").text()).toBe("98.5%");
  });

  it("renders em-dash when value is null", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "AI Tokens", value: null, icon: "🤖" },
    });
    expect(wrapper.get("[data-testid='kpi-value']").text()).toBe("—");
  });

  it("shows skeleton when loading is true", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: null, icon: "⚡", loading: true },
    });
    expect(wrapper.find("[data-testid='kpi-skeleton']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='kpi-value']").exists()).toBe(false);
  });

  it("hides skeleton when loading is false", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 10, icon: "⚡", loading: false },
    });
    expect(wrapper.find("[data-testid='kpi-skeleton']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='kpi-value']").exists()).toBe(true);
  });

  it("renders icon", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 0, icon: "⚡" },
    });
    expect(wrapper.text()).toContain("⚡");
  });

  it("applies violet color class by default", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 1, icon: "⚡" },
    });
    const iconEl = wrapper.find("[aria-hidden='true']");
    expect(iconEl.classes()).toContain("bg-violet-50");
  });

  it("applies green color class", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 1, icon: "✓", color: "green" },
    });
    const iconEl = wrapper.find("[aria-hidden='true']");
    expect(iconEl.classes()).toContain("bg-green-50");
  });

  it("applies blue color class", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 1, icon: "▶", color: "blue" },
    });
    const iconEl = wrapper.find("[aria-hidden='true']");
    expect(iconEl.classes()).toContain("bg-blue-50");
  });

  it("applies amber color class", () => {
    const wrapper = mount(KpiCard, {
      props: { label: "Test", value: 1, icon: "🤖", color: "amber" },
    });
    const iconEl = wrapper.find("[aria-hidden='true']");
    expect(iconEl.classes()).toContain("bg-amber-50");
  });
});
