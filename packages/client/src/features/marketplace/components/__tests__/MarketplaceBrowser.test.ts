import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MarketplaceBrowser from "../MarketplaceBrowser.vue";
import type { MarketplacePackage } from "../../../../shared/api/marketplace.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePkg(overrides: Partial<MarketplacePackage> = {}): MarketplacePackage {
  return {
    packageId: "pkg-1",
    name: "HTTP Transformer",
    version: "1.0.0",
    description: "Transforms HTTP responses",
    author: "Alice",
    nodeType: "http-transformer",
    category: "integrations",
    tags: [],
    permissions: ["http"],
    status: "approved",
    publisherId: "user-1",
    isBuiltIn: true,
    downloads: 100,
    rating: 4.5,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MarketplaceBrowser", () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  it("shows skeleton when loading", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [], loading: true },
    });
    expect(wrapper.find("[data-testid='marketplace-skeleton']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='package-card']").exists()).toBe(false);
  });

  it("shows empty state when no packages and not loading", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [], loading: false },
    });
    expect(wrapper.find("[data-testid='marketplace-empty']").exists()).toBe(true);
  });

  it("renders package cards for each package", () => {
    const pkgs = [makePkg(), makePkg({ packageId: "pkg-2", name: "Email Node", nodeType: "email-node" })];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    expect(wrapper.findAll("[data-testid='package-card']")).toHaveLength(2);
  });

  it("displays package name, description, author, downloads and rating", () => {
    const pkg = makePkg({
      name: "My Node",
      description: "Does something useful",
      author: "Bob",
      downloads: 999,
      rating: 4.8,
    });
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [pkg] },
    });
    const card = wrapper.find("[data-testid='package-card']");
    expect(card.find("[data-testid='package-name']").text()).toBe("My Node");
    expect(card.find("[data-testid='package-description']").text()).toBe("Does something useful");
    expect(card.find("[data-testid='package-author']").text()).toContain("Bob");
    expect(card.find("[data-testid='package-downloads']").text()).toContain("999");
    expect(card.find("[data-testid='package-rating']").text()).toContain("4.8");
  });

  // ── Search filtering ────────────────────────────────────────────────────────

  it("filters packages by search query (name match)", async () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "HTTP Transformer", nodeType: "http-transformer", description: "Transforms requests" }),
      makePkg({ packageId: "pkg-2", name: "Email Sender", nodeType: "email-sender", description: "Sends emails" }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    const input = wrapper.find("[data-testid='search-input']");
    await input.setValue("HTTP");
    const cards = wrapper.findAll("[data-testid='package-card']");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.find("[data-testid='package-name']").text()).toBe("HTTP Transformer");
  });

  it("filters packages by search query (description match)", async () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "Alpha", description: "Sends emails automatically" }),
      makePkg({ packageId: "pkg-2", name: "Beta", description: "Processes webhooks" }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    await wrapper.find("[data-testid='search-input']").setValue("email");
    expect(wrapper.findAll("[data-testid='package-card']")).toHaveLength(1);
    expect(wrapper.find("[data-testid='package-name']").text()).toBe("Alpha");
  });

  it("shows empty state when search has no matches", async () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [makePkg()] },
    });
    await wrapper.find("[data-testid='search-input']").setValue("no-match-xyz");
    expect(wrapper.find("[data-testid='marketplace-empty']").exists()).toBe(true);
  });

  it("emits search event when typing in search input", async () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [] },
    });
    await wrapper.find("[data-testid='search-input']").setValue("http");
    expect(wrapper.emitted("search")).toBeTruthy();
    expect(wrapper.emitted("search")![0]).toEqual(["http"]);
  });

  // ── Category filter ────────────────────────────────────────────────────────

  it("filters by category", async () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "HTTP Node", category: "integrations" }),
      makePkg({ packageId: "pkg-2", name: "CSV Node", category: "data" }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    const select = wrapper.find("[data-testid='category-filter']");
    await select.setValue("integrations");
    expect(wrapper.findAll("[data-testid='package-card']")).toHaveLength(1);
    expect(wrapper.find("[data-testid='package-name']").text()).toBe("HTTP Node");
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  it("sorts by downloads by default (highest first)", () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "Low Downloads", downloads: 10 }),
      makePkg({ packageId: "pkg-2", name: "High Downloads", downloads: 1000 }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    const names = wrapper
      .findAll("[data-testid='package-name']")
      .map((el) => el.text());
    expect(names[0]).toBe("High Downloads");
    expect(names[1]).toBe("Low Downloads");
  });

  it("sorts by rating when selected", async () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "Low Rated", rating: 2.0 }),
      makePkg({ packageId: "pkg-2", name: "High Rated", rating: 5.0 }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    await wrapper.find("[data-testid='sort-select']").setValue("rating");
    const names = wrapper
      .findAll("[data-testid='package-name']")
      .map((el) => el.text());
    expect(names[0]).toBe("High Rated");
  });

  it("sorts by newest when selected", async () => {
    const pkgs = [
      makePkg({ packageId: "pkg-1", name: "Old Node", createdAt: "2023-01-01T00:00:00.000Z" }),
      makePkg({ packageId: "pkg-2", name: "New Node", createdAt: "2024-06-01T00:00:00.000Z" }),
    ];
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: pkgs },
    });
    await wrapper.find("[data-testid='sort-select']").setValue("newest");
    const names = wrapper
      .findAll("[data-testid='package-name']")
      .map((el) => el.text());
    expect(names[0]).toBe("New Node");
  });

  // ── Installed badge ────────────────────────────────────────────────────────

  it("shows installed badge for packages in installedPackageIds", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: {
        packages: [makePkg({ packageId: "pkg-1" })],
        installedPackageIds: ["pkg-1"],
      },
    });
    expect(wrapper.find("[data-testid='installed-badge']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='installed-badge']").text()).toBe("Installed");
  });

  it("does not show installed badge for packages not installed", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: {
        packages: [makePkg({ packageId: "pkg-1" })],
        installedPackageIds: [],
      },
    });
    expect(wrapper.find("[data-testid='installed-badge']").exists()).toBe(false);
  });

  // ── Install button ─────────────────────────────────────────────────────────

  it("emits install event with packageId when install button is clicked", async () => {
    const pkg = makePkg({ packageId: "pkg-1" });
    const wrapper = mount(MarketplaceBrowser, {
      props: { packages: [pkg] },
    });
    await wrapper.find("[data-testid='install-button']").trigger("click");
    expect(wrapper.emitted("install")).toBeTruthy();
    expect(wrapper.emitted("install")![0]).toEqual(["pkg-1"]);
  });

  it("disables install button for already-installed packages", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: {
        packages: [makePkg({ packageId: "pkg-1" })],
        installedPackageIds: ["pkg-1"],
      },
    });
    const btn = wrapper.find("[data-testid='install-button']");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toBe("Installed");
  });

  it("disables install button and shows Installing… while installing", () => {
    const wrapper = mount(MarketplaceBrowser, {
      props: {
        packages: [makePkg({ packageId: "pkg-1" })],
        installing: "pkg-1",
      },
    });
    const btn = wrapper.find("[data-testid='install-button']");
    expect(btn.attributes("disabled")).toBeDefined();
    expect(btn.text()).toBe("Installing…");
  });
});
