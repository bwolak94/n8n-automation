import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { NodeRegistry } from "../../nodes/NodeRegistry.js";
import type { INode, NodeDefinition } from "../../nodes/contracts/INode.js";
import { NodeCategory } from "@automation-hub/shared";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { connect: jest.fn(), query: jest.fn() },
  connectDatabases: jest.fn(),
  connectMongoDB: jest.fn(),
  connectPostgres: jest.fn(),
  connectWithRetry: jest.fn(),
}));

jest.unstable_mockModule("mongoose", () => ({
  default: {
    connect: jest.fn(),
    connection: { readyState: 1 },
    model: jest.fn().mockReturnValue({}),
    models: {},
    Schema: jest.fn().mockImplementation(() => ({ index: jest.fn() })),
  },
}));

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: jest.fn() },
}));

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

const { createApp } = await import("../../app.js");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNode(type: string): INode {
  const definition: NodeDefinition = {
    type,
    label: `${type} label`,
    description: `${type} description`,
    icon: "🔧",
    category: NodeCategory.ACTIONS,
    configSchema: {},
    inputSchema: {},
    outputSchema: {},
  };
  return {
    definition,
    execute: jest.fn() as unknown as INode["execute"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Node Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    const registry = new NodeRegistry();
    registry.register(makeNode("http_request"));
    registry.register(makeNode("delay"));
    app = createApp({ nodeRegistry: registry });
  });

  // ── GET /api/nodes ──────────────────────────────────────────────────────────

  describe("GET /api/nodes", () => {
    it("returns 200 with list of node definitions", async () => {
      const res = await request(app).get("/api/nodes");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it("node definition includes required fields", async () => {
      const res = await request(app).get("/api/nodes");

      const node = res.body.items[0] as Record<string, unknown>;
      expect(node).toHaveProperty("type");
      expect(node).toHaveProperty("label");
      expect(node).toHaveProperty("category");
    });

    it("does not require authentication", async () => {
      const res = await request(app).get("/api/nodes");
      expect(res.status).toBe(200);
    });
  });

  // ── GET /api/nodes/:type ─────────────────────────────────────────────────────

  describe("GET /api/nodes/:type", () => {
    it("returns 200 with a specific node definition", async () => {
      const res = await request(app).get("/api/nodes/http_request");

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("http_request");
    });

    it("returns 404 for unknown node type", async () => {
      const res = await request(app).get("/api/nodes/unknown_type");

      expect(res.status).toBe(404);
    });

    it("does not require authentication", async () => {
      const res = await request(app).get("/api/nodes/delay");
      expect(res.status).toBe(200);
    });
  });

  // ── Empty registry ───────────────────────────────────────────────────────────

  it("returns empty items array when no nodes are registered", async () => {
    const emptyApp = createApp({ nodeRegistry: new NodeRegistry() });
    const res = await request(emptyApp).get("/api/nodes");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});
