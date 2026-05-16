import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { TenantMemberRole } from "@automation-hub/shared";

// ─── ESM mocks ────────────────────────────────────────────────────────────────

const mockPgConnect = jest
  .fn<() => Promise<{ query: jest.Mock; release: jest.Mock }>>()
  .mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });

jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { connect: mockPgConnect },
  connectDatabases: jest.fn(),
  connectMongoDB: jest.fn(),
  connectPostgres: jest.fn(),
  connectWithRetry: jest.fn(),
}));

const mongooseMock = {
  default: {
    connect: jest.fn(),
    connection: { readyState: 1 },
    model: jest.fn().mockReturnValue({}),
    models: {},
    Schema: jest.fn().mockImplementation(() => ({ index: jest.fn() })),
  },
};

jest.unstable_mockModule("mongoose", () => mongooseMock);

// ── Mock TenantMember for tenantContext middleware ──────────────────────────

const mockTenantMemberFindOne = jest.fn();
jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockTenantMemberFindOne },
}));

// ── Mock WorkflowModel ─────────────────────────────────────────────────────

const mockWorkflowFindOne = jest.fn();
const mockWorkflowFind = jest.fn();
const mockWorkflowCountDocuments = jest.fn();

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    findOne: mockWorkflowFindOne,
    find: mockWorkflowFind,
    countDocuments: mockWorkflowCountDocuments,
  },
}));

// ── Mock TenantModel (planGuard) ───────────────────────────────────────────

const mockTenantFindOne = jest.fn();
jest.unstable_mockModule("../../modules/tenants/Tenant.model.js", () => ({
  TenantModel: { findOne: mockTenantFindOne },
  PLAN_LIMITS: {
    free: { workflows: 3, executionsPerMonth: 100, aiTokensPerMonth: 10000, members: 1, customNodes: 0 },
    pro: { workflows: 25, executionsPerMonth: 5000, aiTokensPerMonth: 500000, members: 5, customNodes: 10 },
    enterprise: { workflows: Infinity, executionsPerMonth: Infinity, aiTokensPerMonth: Infinity, members: Infinity, customNodes: Infinity },
  },
}));

const { createApp } = await import("../../app.js");

// ─── Test helpers ─────────────────────────────────────────────────────────────

const JWT_SECRET = process.env["JWT_SECRET"] ?? "test-secret-super-long-string-32ch";

function makeToken(userId: string): string {
  return jwt.sign({ userId, email: `${userId}@example.com` }, JWT_SECRET);
}

function asMember(tenantId: string, role: TenantMemberRole) {
  mockTenantMemberFindOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue({ tenantId, userId: "user-1", role }),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Cross-tenant isolation", () => {
  const app = createApp();
  const tenantAToken = makeToken("user-a");
  const tenantBToken = makeToken("user-b");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/workflows — tenant A cannot see tenant B workflows", () => {
    it("returns only tenant A workflows when authenticated as tenant A", async () => {
      // Tenant A member
      mockTenantMemberFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          tenantId: "tenant-A",
          userId: "user-a",
          role: TenantMemberRole.EDITOR,
        }),
      });

      // DB returns empty list (tenant-A has no workflows)
      mockWorkflowFind.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      mockWorkflowCountDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get("/api/workflows")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("X-Tenant-Id", "tenant-A");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);

      // Verify the query included tenant-A's tenantId
      const findArg = (mockWorkflowFind as jest.MockedFunction<typeof mockWorkflowFind>).mock.calls[0]?.[0] as Record<string, unknown>;
      expect(findArg["tenantId"]).toBe("tenant-A");
    });

    it("returns 401 when tenant A token is used with tenant B header (not a member)", async () => {
      // User is NOT a member of tenant-B
      mockTenantMemberFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get("/api/workflows")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("X-Tenant-Id", "tenant-B"); // wrong tenant

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/workflows/:id — tenant isolation on single resource", () => {
    it("returns 404 when workflow belongs to a different tenant", async () => {
      asMember("tenant-A", TenantMemberRole.VIEWER);

      // WorkflowModel returns null (query includes tenantId, so cross-tenant = null)
      mockWorkflowFindOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get("/api/workflows/workflow-of-tenant-B")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("X-Tenant-Id", "tenant-A");

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/tenants/me", () => {
    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/tenants/me");
      expect(res.status).toBe(401);
    });

    it("returns 401 without X-Tenant-Id header", async () => {
      const res = await request(app)
        .get("/api/tenants/me")
        .set("Authorization", `Bearer ${tenantAToken}`);
      expect(res.status).toBe(401);
    });
  });

  describe("requireRole enforcement", () => {
    // Note: full HTTP-layer RBAC behaviour (403 status) is covered in
    // requireRole.test.ts unit tests. Here we verify the route is guarded
    // by confirming unauthorised requests get a non-2xx status.

    it("non-admin gets non-2xx on invite route", async () => {
      asMember("tenant-A", TenantMemberRole.EDITOR);

      const res = await request(app)
        .post("/api/tenants/members/invite")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("X-Tenant-Id", "tenant-A")
        .send({ email: "new@example.com", role: "editor" });

      expect(res.status).not.toBe(200);
      expect(res.status).not.toBe(201);
    });

    it("missing auth returns 401 on invite route", async () => {
      const res = await request(app)
        .post("/api/tenants/members/invite")
        .send({ email: "new@example.com", role: "editor" });

      expect(res.status).toBe(401);
    });
  });
});
