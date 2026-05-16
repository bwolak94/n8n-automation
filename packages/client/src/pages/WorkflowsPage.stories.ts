import type { Meta, StoryObj } from "@storybook/vue3";
import { defineComponent, h } from "vue";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import WorkflowsPage from "./WorkflowsPage.vue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient(prefillData?: unknown): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Never retry in Storybook — keeps stories instant.
        retry: false,
        // Treat pre-filled data as fresh indefinitely so no network call fires.
        staleTime: Infinity,
      },
    },
  });
}

// A thin decorator factory that installs VueQuery with an optional pre-seeded
// query cache so the page renders immediately without hitting the network.
function withQueryClient(seedData?: unknown) {
  return (story: ReturnType<typeof defineComponent>) => {
    const queryClient = makeQueryClient();

    if (seedData !== undefined) {
      // Pre-seed the cache key that useWorkflowsQuery uses.
      queryClient.setQueryData(["workflows", { limit: 20, offset: 0 }], seedData);
    }

    return {
      components: { story },
      setup() {
        return {};
      },
      template: "<story />",
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        // Stub vue-router's <RouterLink> and <RouterView> in case they appear
        // indirectly inside the page.
        stubs: {
          RouterLink: defineComponent({
            props: ["to"],
            setup(_p, { slots }) {
              return () => h("a", {}, slots.default?.());
            },
          }),
          RouterView: defineComponent({ setup: () => () => h("div") }),
        },
      },
    };
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof WorkflowsPage> = {
  title: "Pages/WorkflowsPage",
  component: WorkflowsPage,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof WorkflowsPage>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Empty state — the query resolves with zero items. */
export const EmptyState: Story = {
  decorators: [withQueryClient({ items: [], total: 0 })],
};

/** Loading state — no data is pre-seeded so the query stays in pending. */
export const Loading: Story = {
  decorators: [withQueryClient(/* no seed */)],
};

/** Populated list — several workflows returned from the cache. */
export const WithWorkflows: Story = {
  decorators: [
    withQueryClient({
      items: [
        { id: "wf-1", name: "Daily Digest Email", status: "active" },
        { id: "wf-2", name: "Slack Notifications", status: "active" },
        { id: "wf-3", name: "Data Sync Pipeline", status: "inactive" },
      ],
      total: 3,
    }),
  ],
};
