import { describe, it, expect, beforeEach } from "@jest/globals";
import { TenantNodeRegistry } from "../../modules/marketplace/TenantNodeRegistry.js";
import { NodeRegistry } from "../../nodes/NodeRegistry.js";
import { UnknownNodeTypeError } from "../../shared/errors/index.js";
import type { INode, NodeOutput, ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeNode(type: string, name = `Node ${type}`): INode {
  return {
    definition: { type, name },
    execute: async (_input: unknown, _config: Record<string, unknown>, _ctx: ExecutionContext): Promise<NodeOutput> => ({
      data: { type },
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TenantNodeRegistry", () => {
  let registry: TenantNodeRegistry;

  beforeEach(() => {
    registry = new TenantNodeRegistry();
    // Register a global node
    registry.register(makeNode("http", "HTTP Node"));
    registry.register(makeNode("email", "Email Node"));
  });

  // ── Global behaviour (inherited) ───────────────────────────────────────────

  describe("global registry behaviour (inherited)", () => {
    it("resolves global nodes normally", () => {
      expect(registry.resolve("http").definition.type).toBe("http");
    });

    it("listAll returns all global nodes", () => {
      expect(registry.listAll()).toHaveLength(2);
    });

    it("getAll returns INode instances", () => {
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  // ── registerForTenant / resolveForTenant ───────────────────────────────────

  describe("registerForTenant", () => {
    it("registers a node for a specific tenant", () => {
      const customNode = makeNode("custom-a");
      registry.registerForTenant("tenant-A", customNode);
      expect(registry.resolveForTenant("custom-a", "tenant-A").definition.type).toBe("custom-a");
    });

    it("tenant-specific node is NOT available to other tenants", () => {
      registry.registerForTenant("tenant-A", makeNode("tenant-a-only"));
      // Tenant B doesn't have it and it's not global → UnknownNodeTypeError
      expect(() => registry.resolveForTenant("tenant-a-only", "tenant-B")).toThrow(UnknownNodeTypeError);
    });

    it("different tenants can have different installed nodes", () => {
      registry.registerForTenant("tenant-A", makeNode("node-for-a"));
      registry.registerForTenant("tenant-B", makeNode("node-for-b"));

      expect(registry.resolveForTenant("node-for-a", "tenant-A").definition.type).toBe("node-for-a");
      expect(registry.resolveForTenant("node-for-b", "tenant-B").definition.type).toBe("node-for-b");

      expect(() => registry.resolveForTenant("node-for-b", "tenant-A")).toThrow(UnknownNodeTypeError);
      expect(() => registry.resolveForTenant("node-for-a", "tenant-B")).toThrow(UnknownNodeTypeError);
    });

    it("falls back to global nodes when tenant doesn't have the type", () => {
      registry.registerForTenant("tenant-A", makeNode("custom-a"));
      // tenant-A can still access global 'http'
      expect(registry.resolveForTenant("http", "tenant-A").definition.type).toBe("http");
    });
  });

  // ── unregisterForTenant ────────────────────────────────────────────────────

  describe("unregisterForTenant", () => {
    it("removes a tenant-specific node", () => {
      registry.registerForTenant("tenant-A", makeNode("removable"));
      registry.unregisterForTenant("tenant-A", "removable");
      expect(() => registry.resolveForTenant("removable", "tenant-A")).toThrow(UnknownNodeTypeError);
    });

    it("does nothing when node was never registered", () => {
      // Should not throw
      expect(() => registry.unregisterForTenant("tenant-A", "nonexistent")).not.toThrow();
    });
  });

  // ── getForTenant ───────────────────────────────────────────────────────────

  describe("getForTenant", () => {
    it("returns a NodeRegistry with both global and tenant-specific nodes", () => {
      registry.registerForTenant("tenant-A", makeNode("custom-a"));
      const scoped = registry.getForTenant("tenant-A");

      expect(scoped).toBeInstanceOf(NodeRegistry);
      // Global nodes present
      expect(scoped.resolve("http").definition.type).toBe("http");
      expect(scoped.resolve("email").definition.type).toBe("email");
      // Tenant node present
      expect(scoped.resolve("custom-a").definition.type).toBe("custom-a");
    });

    it("returns only global nodes when tenant has no custom nodes", () => {
      const scoped = registry.getForTenant("tenant-with-no-nodes");
      expect(scoped.listAll()).toHaveLength(2);
    });

    it("different tenants get different scoped registries", () => {
      registry.registerForTenant("tenant-A", makeNode("node-a"));
      registry.registerForTenant("tenant-B", makeNode("node-b"));

      const scopedA = registry.getForTenant("tenant-A");
      const scopedB = registry.getForTenant("tenant-B");

      expect(scopedA.has("node-a")).toBe(true);
      expect(scopedA.has("node-b")).toBe(false);
      expect(scopedB.has("node-b")).toBe(true);
      expect(scopedB.has("node-a")).toBe(false);
    });
  });

  // ── listForTenant ──────────────────────────────────────────────────────────

  describe("listForTenant", () => {
    it("returns global + tenant node definitions", () => {
      registry.registerForTenant("tenant-A", makeNode("custom-a"));
      const defs = registry.listForTenant("tenant-A");
      expect(defs).toHaveLength(3); // http + email + custom-a
    });

    it("tenant node type overrides global in the listing if same type", () => {
      // Custom node with same type as global — tenant version wins in listing
      const overrideHttp = makeNode("http", "Tenant Override HTTP");
      registry.registerForTenant("tenant-A", overrideHttp);
      const defs = registry.listForTenant("tenant-A");
      const httpDef = defs.find((d) => d.type === "http");
      expect(httpDef?.name).toBe("Tenant Override HTTP");
    });
  });

  // ── hasForTenant ───────────────────────────────────────────────────────────

  describe("hasForTenant", () => {
    it("returns true for global nodes", () => {
      expect(registry.hasForTenant("http", "any-tenant")).toBe(true);
    });

    it("returns true for tenant-specific nodes", () => {
      registry.registerForTenant("tenant-A", makeNode("custom-a"));
      expect(registry.hasForTenant("custom-a", "tenant-A")).toBe(true);
    });

    it("returns false for nodes not available to the tenant", () => {
      registry.registerForTenant("tenant-A", makeNode("custom-a"));
      expect(registry.hasForTenant("custom-a", "tenant-B")).toBe(false);
    });
  });
});
