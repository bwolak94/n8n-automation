import type { Meta, StoryObj } from "@storybook/vue3";
import { createPinia, setActivePinia } from "pinia";
import CanvasToolbar from "./CanvasToolbar.vue";
import { useCanvasStore } from "../../../stores/canvasStore.js";

const meta: Meta<typeof CanvasToolbar> = {
  title: "Canvas/CanvasToolbar",
  component: CanvasToolbar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (story) => {
      const pinia = createPinia();
      setActivePinia(pinia);
      return {
        components: { story },
        setup() {
          return {};
        },
        template: "<story />",
        global: {
          plugins: [pinia],
        },
      };
    },
  ],
};

export default meta;
type Story = StoryObj<typeof CanvasToolbar>;

export const Clean: Story = {
  decorators: [
    (story) => {
      const pinia = createPinia();
      setActivePinia(pinia);
      return {
        components: { story },
        setup() {
          // isDirty = false, canUndo = false, canRedo = false (default state)
          useCanvasStore();
          return {};
        },
        template: "<story />",
        global: { plugins: [pinia] },
      };
    },
  ],
};

export const UnsavedChanges: Story = {
  decorators: [
    (story) => {
      const pinia = createPinia();
      setActivePinia(pinia);
      return {
        components: { story },
        setup() {
          const store = useCanvasStore();
          // Force dirty state so the Save button lights up
          store.$patch({ isDirty: true });
          return {};
        },
        template: "<story />",
        global: { plugins: [pinia] },
      };
    },
  ],
};

export const WithUndoAvailable: Story = {
  decorators: [
    (story) => {
      const pinia = createPinia();
      setActivePinia(pinia);
      return {
        components: { story },
        setup() {
          const store = useCanvasStore();
          store.$patch({ isDirty: true });
          return {};
        },
        template: "<story />",
        global: { plugins: [pinia] },
      };
    },
  ],
};
