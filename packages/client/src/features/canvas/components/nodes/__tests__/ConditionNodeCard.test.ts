import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";

vi.mock("@vue-flow/core", () => ({
  Handle: defineComponent({
    name: "Handle",
    props: ["type", "position", "id"],
    template: '<div v-bind="$attrs" />',
  }),
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import ConditionNodeCard from "../ConditionNodeCard.vue";

const defaultProps = {
  id: "node-1",
  type: "condition",
  position: { x: 0, y: 0 },
  data: {
    label: "Check Value",
    status: "idle" as const,
    category: "logic",
    config: {},
  },
};

describe("ConditionNodeCard", () => {
  it("renders the node label", () => {
    const wrapper = mount(ConditionNodeCard, { props: defaultProps });
    expect(wrapper.find("[data-testid='node-label']").text()).toBe("Check Value");
  });

  it("renders two output handles labelled 'true' and 'false'", () => {
    const wrapper = mount(ConditionNodeCard, { props: defaultProps });
    expect(wrapper.find("[data-testid='handle-true']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='handle-false']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='handle-true-label']").text()).toBe("true");
    expect(wrapper.find("[data-testid='handle-false-label']").text()).toBe("false");
  });

  it("renders a target (input) handle", () => {
    const wrapper = mount(ConditionNodeCard, { props: defaultProps });
    expect(wrapper.find("[data-testid='handle-target']").exists()).toBe(true);
  });

  it("renders the status badge", () => {
    const wrapper = mount(ConditionNodeCard, { props: defaultProps });
    expect(wrapper.find("[data-testid='status-badge-idle']").exists()).toBe(true);
  });

  it("matches snapshot", () => {
    const wrapper = mount(ConditionNodeCard, { props: defaultProps });
    expect(wrapper.html()).toMatchSnapshot();
  });
});
