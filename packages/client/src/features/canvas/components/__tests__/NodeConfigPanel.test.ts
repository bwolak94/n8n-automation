import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { render, fireEvent, waitFor } from "@testing-library/vue";
import { setActivePinia, createPinia } from "pinia";
import { useCanvasStore } from "../../../../stores/canvasStore.js";
import { useNodeRegistryStore } from "../../../../stores/nodeRegistryStore.js";
import NodeConfigPanel from "../NodeConfigPanel.vue";

// Suppress VeeValidate console warnings in tests
vi.spyOn(console, "warn").mockImplementation(() => undefined);

vi.mock("../../../../shared/api/workflows.js", () => ({
  updateWorkflow: vi.fn(),
  fetchWorkflows: vi.fn(),
  fetchWorkflow: vi.fn(),
  createWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function buildDef(properties: Record<string, unknown>) {
  return {
    type: "http_request",
    label: "HTTP Request",
    description: "",
    icon: "🌐",
    category: "actions",
    configSchema: { type: "object", properties },
    inputSchema: {},
    outputSchema: {},
  };
}

function setup(properties: Record<string, unknown> = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  const canvasStore = useCanvasStore();
  const registryStore = useNodeRegistryStore();

  // Add a node and select it
  const node = canvasStore.addNode({
    type: "http_request",
    category: "actions",
    label: "HTTP",
    position: { x: 0, y: 0 },
    config: {},
  });
  canvasStore.selectNode(node.id);

  // Register node definition with configSchema
  registryStore.setDefinitions([buildDef(properties)]);

  const wrapper = mount(NodeConfigPanel, {
    global: { plugins: [pinia] },
  });

  return { wrapper, canvasStore, node };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("NodeConfigPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("is not rendered when no node is selected", () => {
    const wrapper = mount(NodeConfigPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.find("[data-testid='node-config-panel']").exists()).toBe(false);
  });

  it("renders when a node is selected", () => {
    const { wrapper } = setup({ url: { type: "string", title: "URL" } });
    expect(wrapper.find("[data-testid='node-config-panel']").exists()).toBe(true);
  });

  it("renders a text input for a string schema field", () => {
    const { wrapper } = setup({ url: { type: "string", title: "URL" } });
    const input = wrapper.find("[data-testid='input-url']");
    expect(input.exists()).toBe(true);
    expect(input.attributes("type")).toBe("text");
  });

  it("renders a number input for a number schema field", () => {
    const { wrapper } = setup({ timeout: { type: "number", title: "Timeout" } });
    const input = wrapper.find("[data-testid='input-timeout']");
    expect(input.exists()).toBe(true);
    expect(input.attributes("type")).toBe("number");
  });

  it("renders a select for an enum schema field", () => {
    const { wrapper } = setup({
      method: { enum: ["GET", "POST", "PUT", "DELETE"], title: "Method" },
    });
    const select = wrapper.find("[data-testid='input-method']");
    expect(select.exists()).toBe(true);
    expect(select.element.tagName.toLowerCase()).toBe("select");
    expect(select.findAll("option").map((o) => o.text())).toContain("GET");
    expect(select.findAll("option").map((o) => o.text())).toContain("POST");
  });

  it("shows 'No configuration required' when configSchema has no properties", () => {
    const { wrapper } = setup();
    expect(wrapper.find("[data-testid='no-config-message']").exists()).toBe(true);
  });

  it("close button deselects the node", async () => {
    const { wrapper, canvasStore } = setup({ url: { type: "string" } });
    await wrapper.find("[data-testid='panel-close']").trigger("click");
    expect(canvasStore.selectedNodeId).toBeNull();
  });

  it("submit calls canvasStore.updateNodeConfig with form values", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const canvasStore = useCanvasStore();
    const registryStore = useNodeRegistryStore();
    const node = canvasStore.addNode({ type: "http_request", category: "actions", label: "HTTP", position: { x: 0, y: 0 }, config: {} });
    canvasStore.selectNode(node.id);
    registryStore.setDefinitions([buildDef({ url: { type: "string", title: "URL" } })]);
    const spy = vi.spyOn(canvasStore, "updateNodeConfig");

    const { getByTestId } = render(NodeConfigPanel, { global: { plugins: [pinia] } });
    await fireEvent.update(getByTestId("input-url"), "https://api.example.com");
    await fireEvent.submit(getByTestId("config-form"));
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2000 });

    expect(spy).toHaveBeenCalledWith(node.id, expect.objectContaining({ url: "https://api.example.com" }));
  });

  it("submit closes the panel (sets selectedNodeId to null)", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const canvasStore = useCanvasStore();
    const registryStore = useNodeRegistryStore();
    const node = canvasStore.addNode({ type: "http_request", category: "actions", label: "HTTP", position: { x: 0, y: 0 }, config: {} });
    canvasStore.selectNode(node.id);
    registryStore.setDefinitions([buildDef({ url: { type: "string", title: "URL" } })]);

    const { getByTestId } = render(NodeConfigPanel, { global: { plugins: [pinia] } });
    await fireEvent.submit(getByTestId("config-form"));
    await waitFor(() => expect(canvasStore.selectedNodeId).toBeNull(), { timeout: 2000 });
  });
});
