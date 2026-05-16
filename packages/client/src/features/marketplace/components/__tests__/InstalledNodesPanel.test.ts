import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import InstalledNodesPanel from "../InstalledNodesPanel.vue";
import type { InstalledNode } from "../../../../shared/api/marketplace.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<InstalledNode> = {}): InstalledNode {
  return {
    tenantId: "tenant-1",
    packageId: "pkg-1",
    nodeType: "custom-node",
    version: "1.0.0",
    installedAt: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InstalledNodesPanel", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it("shows skeleton when loading", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: { installedNodes: [], loading: true },
    });
    expect(wrapper.find("[data-testid='installed-skeleton']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='installed-node-row']").exists()).toBe(false);
  });

  it("shows empty state when no nodes installed", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: { installedNodes: [], loading: false },
    });
    expect(wrapper.find("[data-testid='installed-empty']").exists()).toBe(true);
  });

  it("renders a row for each installed node", () => {
    const nodes = [
      makeNode({ packageId: "pkg-1", nodeType: "http-node" }),
      makeNode({ packageId: "pkg-2", nodeType: "email-node" }),
    ];
    const wrapper = mount(InstalledNodesPanel, {
      props: { installedNodes: nodes },
    });
    expect(wrapper.findAll("[data-testid='installed-node-row']")).toHaveLength(2);
  });

  it("displays nodeType and version for each node", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: {
        installedNodes: [makeNode({ nodeType: "my-custom-node", version: "2.3.1" })],
      },
    });
    const row = wrapper.find("[data-testid='installed-node-row']");
    expect(row.find("[data-testid='installed-node-type']").text()).toBe("my-custom-node");
    expect(row.find("[data-testid='installed-node-version']").text()).toBe("v2.3.1");
  });

  it("displays formatted install date", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: {
        installedNodes: [makeNode({ installedAt: "2024-03-20T00:00:00.000Z" })],
      },
    });
    const dateEl = wrapper.find("[data-testid='installed-node-date']");
    // Date is locale-formatted so just check it's not empty
    expect(dateEl.text().trim()).toBeTruthy();
  });

  // ── Uninstall button ───────────────────────────────────────────────────────

  it("emits uninstall event with packageId when button is clicked", async () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: { installedNodes: [makeNode({ packageId: "pkg-1" })] },
    });
    await wrapper.find("[data-testid='uninstall-button']").trigger("click");
    expect(wrapper.emitted("uninstall")).toBeTruthy();
    expect(wrapper.emitted("uninstall")![0]).toEqual(["pkg-1"]);
  });

  it("disables uninstall button and shows Removing… while uninstalling", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: {
        installedNodes: [makeNode({ packageId: "pkg-1" })],
        uninstalling: "pkg-1",
      },
    });
    const btn = wrapper.find("[data-testid='uninstall-button']");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toBe("Removing…");
  });

  it("enables uninstall button when not uninstalling", () => {
    const wrapper = mount(InstalledNodesPanel, {
      props: {
        installedNodes: [makeNode({ packageId: "pkg-1" })],
        uninstalling: null,
      },
    });
    const btn = wrapper.find("[data-testid='uninstall-button']");
    expect(btn.attributes("disabled")).toBeUndefined();
    expect(btn.text()).toBe("Uninstall");
  });

  it("only disables the button for the node being uninstalled", () => {
    const nodes = [
      makeNode({ packageId: "pkg-1", nodeType: "node-a" }),
      makeNode({ packageId: "pkg-2", nodeType: "node-b" }),
    ];
    const wrapper = mount(InstalledNodesPanel, {
      props: { installedNodes: nodes, uninstalling: "pkg-1" },
    });
    const buttons = wrapper.findAll("[data-testid='uninstall-button']");
    expect(buttons[0]?.attributes("disabled")).toBeDefined();
    expect(buttons[1]?.attributes("disabled")).toBeUndefined();
  });
});
