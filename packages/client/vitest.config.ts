import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
      exclude: [
        "src/test/**",
        "src/main.ts",
        "src/App.vue",
        "src/pages/**",
        "src/router/index.ts",
        "src/shared/queries/**",
        "src/shared/types/**",
        "src/shared/api/auth.ts",
        "src/shared/api/workflows.ts",
        "src/shared/api/executions.ts",
        "src/shared/api/nodes.ts",
        "src/shared/api/index.ts",
        "src/shared/api/analytics.ts",
        "src/shared/api/members.ts",
        "src/shared/api/queue.ts",
        "src/shared/api/marketplace.ts",
        // Canvas view-layer components (no testable logic)
        "src/features/canvas/components/WorkflowCanvas.vue",
        "src/features/canvas/components/CanvasToolbar.vue",
        "src/features/canvas/components/NodePalette.vue",
        "src/features/canvas/components/nodes/HttpRequestNodeCard.vue",
        "src/features/canvas/components/nodes/AiTransformNodeCard.vue",
        "src/features/canvas/components/nodes/WebhookNodeCard.vue",
        "src/features/canvas/components/nodes/JavaScriptNodeCard.vue",
        // Chart.js wrappers — no testable logic, rendering depends on canvas
        "src/features/dashboard/components/ExecutionVolumeChart.vue",
        "src/features/dashboard/components/NodeTypeChart.vue",
        // Execution list view — paginated table, covered by integration tests
        "src/features/execution/components/ExecutionListView.vue",
        // Layout/settings components with no testable logic
        "src/shared/components/AppLayout.vue",
        "src/features/settings/components/OrgSettingsPanel.vue",
        // i18n barrel — plugin registration, no business logic
        "src/shared/i18n/index.ts",
        // Build / config / storybook files
        "*.config.*",
        ".storybook/**",
        "**/*.stories.ts",
        "**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@automation-hub/shared": fileURLToPath(
        new URL("../shared/src/index.ts", import.meta.url)
      ),
    },
  },
});
