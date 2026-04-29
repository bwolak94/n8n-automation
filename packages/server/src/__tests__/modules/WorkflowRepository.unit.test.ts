import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Pool } from "pg";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockFindOne = jest.fn();

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: jest.fn(),
    findOne: mockFindOne,
    countDocuments: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

// database must be mocked to prevent real connections
jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { query: jest.fn(), connect: jest.fn() } as unknown as Pool,
  connectDatabases: jest.fn(),
  connectMongoDB: jest.fn(),
  connectPostgres: jest.fn(),
  connectWithRetry: jest.fn(),
}));

const { WorkflowRepository } = await import(
  "../../modules/workflows/WorkflowRepository.js"
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockDoc = {
  _id: "wf-1",
  tenantId: "tenant-1",
  name: "Test Workflow",
  description: "desc",
  status: "active",
  nodes: [
    {
      id: "n1",
      type: "http_request",
      category: "actions",
      label: "HTTP",
      position: { x: 0, y: 0 },
      config: { url: "http://example.com" },
    },
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }],
  variables: { key: "value" },
  tags: ["tag1"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function leanReturning(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowRepository", () => {
  let repo: InstanceType<typeof WorkflowRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new WorkflowRepository();
  });

  // ── findById (engine version — maps edges source/target → from/to) ──────────

  describe("findById (engine)", () => {
    it("returns null when workflow is not found", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      const result = await repo.findById("wf-1", "tenant-1");

      expect(result).toBeNull();
    });

    it("returns WorkflowDefinition with edges mapped to from/to", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockDoc));

      const result = await repo.findById("wf-1", "tenant-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("wf-1");
      expect(result!.tenantId).toBe("tenant-1");
      expect(result!.edges).toEqual([{ from: "n1", to: "n2" }]);
    });

    it("maps node fields into WorkflowNode shape", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockDoc));

      const result = await repo.findById("wf-1", "tenant-1");

      expect(result!.nodes[0]).toEqual({
        id: "n1",
        type: "http_request",
        config: { url: "http://example.com" },
      });
    });

    it("handles empty nodes and edges arrays", async () => {
      mockFindOne.mockReturnValue(
        leanReturning({ ...mockDoc, nodes: [], edges: [] })
      );

      const result = await repo.findById("wf-1", "tenant-1");

      expect(result!.nodes).toHaveLength(0);
      expect(result!.edges).toHaveLength(0);
    });
  });

  // ── findByIdForWebhook (no tenantId filter) ──────────────────────────────────

  describe("findByIdForWebhook", () => {
    it("returns null when workflow is not found", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      const result = await repo.findByIdForWebhook("wf-1");

      expect(result).toBeNull();
    });

    it("returns ApiWorkflow without filtering by tenantId", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockDoc));

      const result = await repo.findByIdForWebhook("wf-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("wf-1");
      expect(result!.tenantId).toBe("tenant-1");
      expect(result!.nodes[0].config).toEqual({ url: "http://example.com" });
    });

    it("does not pass tenantId to findOne", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      await repo.findByIdForWebhook("wf-1");

      // findOne call should NOT include tenantId in the filter
      const callArg = mockFindOne.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(callArg).not.toHaveProperty("tenantId");
    });
  });
});
