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
        // Canvas view-layer components (no testable logic)
        "src/features/canvas/components/WorkflowCanvas.vue",
        "src/features/canvas/components/CanvasToolbar.vue",
        "src/features/canvas/components/NodePalette.vue",
        "src/features/canvas/components/nodes/HttpRequestNodeCard.vue",
        "src/features/canvas/components/nodes/AiTransformNodeCard.vue",
        "src/features/canvas/components/nodes/WebhookNodeCard.vue",
        "src/features/canvas/components/nodes/JavaScriptNodeCard.vue",
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
