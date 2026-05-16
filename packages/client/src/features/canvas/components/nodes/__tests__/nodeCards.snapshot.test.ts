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

import HttpRequestNodeCard from "../HttpRequestNodeCard.vue";
import AiTransformNodeCard from "../AiTransformNodeCard.vue";
import WebhookNodeCard from "../WebhookNodeCard.vue";
import JavaScriptNodeCard from "../JavaScriptNodeCard.vue";

const makeProps = (overrides = {}) => ({
  id: "n1",
  type: "test",
  position: { x: 0, y: 0 },
  data: {
    label: "Test Node",
    status: "idle" as const,
    category: "actions",
    config: {},
    ...overrides,
  },
});

describe("Node card snapshots", () => {
  it("HttpRequestNodeCard — default", () => {
    expect(mount(HttpRequestNodeCard, { props: makeProps() }).html()).toMatchSnapshot();
  });

  it("HttpRequestNodeCard — with URL", () => {
    expect(
      mount(HttpRequestNodeCard, { props: makeProps({ config: { url: "https://api.example.com" } }) }).html()
    ).toMatchSnapshot();
  });

  it("AiTransformNodeCard — default", () => {
    expect(mount(AiTransformNodeCard, { props: makeProps({ category: "ai" }) }).html()).toMatchSnapshot();
  });

  it("WebhookNodeCard — default", () => {
    expect(
      mount(WebhookNodeCard, { props: makeProps({ category: "triggers", config: { path: "my-hook" } }) }).html()
    ).toMatchSnapshot();
  });

  it("JavaScriptNodeCard — default", () => {
    expect(mount(JavaScriptNodeCard, { props: makeProps({ category: "logic" }) }).html()).toMatchSnapshot();
  });
});
