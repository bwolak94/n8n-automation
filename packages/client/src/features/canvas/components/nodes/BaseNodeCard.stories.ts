import type { Meta, StoryObj } from "@storybook/vue3";
import { defineComponent, h } from "vue";
import BaseNodeCard from "./BaseNodeCard.vue";

// Provide a no-op stub for Handle so the story renders without a VueFlow context.
const HandleStub = defineComponent({
  name: "Handle",
  props: ["type", "position"],
  setup(_props, { attrs }) {
    return () =>
      h("div", {
        class: "absolute h-3 w-3 rounded-full bg-gray-400",
        ...attrs,
      });
  },
});

const meta: Meta<typeof BaseNodeCard> = {
  title: "Canvas/BaseNodeCard",
  component: BaseNodeCard,
  parameters: { layout: "centered" },
  // Inject the Handle stub globally so Vue resolves it inside BaseNodeCard.
  decorators: [
    (story) => ({
      components: { story },
      template: "<story />",
      global: {
        stubs: { Handle: HandleStub },
      },
    }),
  ],
  argTypes: {
    label: { control: "text" },
    icon: { control: "text" },
    status: {
      control: "select",
      options: ["idle", "running", "success", "error"],
    },
    category: {
      control: "select",
      options: [
        "triggers",
        "actions",
        "logic",
        "data",
        "ai",
        "communication",
        "integrations",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseNodeCard>;

export const Default: Story = {
  args: {
    label: "HTTP Request",
    icon: "🌐",
    status: "idle",
    category: "actions",
  },
};

export const Running: Story = {
  args: {
    label: "HTTP Request",
    icon: "🌐",
    status: "running",
    category: "actions",
  },
};

export const Success: Story = {
  args: {
    label: "HTTP Request",
    icon: "🌐",
    status: "success",
    category: "actions",
  },
};

export const Error: Story = {
  args: {
    label: "HTTP Request",
    icon: "🌐",
    status: "error",
    category: "actions",
  },
};

export const TriggerCategory: Story = {
  args: {
    label: "Webhook Trigger",
    icon: "⚡",
    status: "idle",
    category: "triggers",
  },
};

export const AiCategory: Story = {
  args: {
    label: "AI Transform",
    icon: "🤖",
    status: "idle",
    category: "ai",
  },
};
