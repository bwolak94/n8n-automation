import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AiUsagePanel from "../AiUsagePanel.vue";

describe("AiUsagePanel", () => {
  it("shows skeleton when loading", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 0, tokenLimit: 100000, loading: true },
    });
    expect(wrapper.find("[data-testid='ai-usage-skeleton']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='ai-tokens-used']").exists()).toBe(false);
  });

  it("renders tokens used and limit", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 5000, tokenLimit: 100000 },
    });
    expect(wrapper.find("[data-testid='ai-tokens-used']").text()).toContain("5.0K");
    expect(wrapper.text()).toContain("100.0K");
  });

  it("renders raw token count when < 1000", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 500, tokenLimit: 1000 },
    });
    expect(wrapper.find("[data-testid='ai-tokens-used']").text()).toContain("500");
  });

  it("renders estimated cost", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 10000, tokenLimit: 100000 },
    });
    // $0.002 per 1K = $0.02 for 10K
    expect(wrapper.find("[data-testid='ai-estimated-cost']").text()).toBe("$0.0200");
  });

  it("shows violet bar below 70%", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 50000, tokenLimit: 100000 },
    });
    expect(wrapper.find("[data-testid='ai-usage-bar']").classes()).toContain("bg-violet-500");
  });

  it("shows amber bar at 70%", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 70000, tokenLimit: 100000 },
    });
    expect(wrapper.find("[data-testid='ai-usage-bar']").classes()).toContain("bg-amber-400");
  });

  it("shows red bar at 90%+", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 95000, tokenLimit: 100000 },
    });
    expect(wrapper.find("[data-testid='ai-usage-bar']").classes()).toContain("bg-red-500");
  });

  it("caps bar width at 100%", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 200000, tokenLimit: 100000 },
    });
    const bar = wrapper.find("[data-testid='ai-usage-bar']");
    expect(bar.attributes("style")).toContain("width: 100%");
  });

  it("shows 0% usage when tokenLimit is 0", () => {
    const wrapper = mount(AiUsagePanel, {
      props: { tokensUsed: 0, tokenLimit: 0 },
    });
    expect(wrapper.text()).toContain("0% used");
  });
});
