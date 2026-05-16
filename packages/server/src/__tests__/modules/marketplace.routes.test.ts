import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { MarketplaceService } from "../../modules/marketplace/MarketplaceService.js";
import type { PackageRecord, InstalledNodeRecord } from "../../modules/marketplace/MarketplaceRepository.js";

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

const mockFindOneTenant = jest.fn().mockReturnValue({
  lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "owner" }),
});

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";

function token(): string {
  return jwt.sign({ userId: "user-1", email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function auth(req: ReturnType<typeof request.agent>) {
  return req
    .set("Authorization", `Bearer ${token()}`)
    .set("X-Tenant-Id", TENANT);
}

function makePackage(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    packageId: "pkg-1",
    name: "Test Node",
    version: "1.0.0",
    description: "A test node",
    author: "Alice",
    nodeType: "custom-node",
    category: "integrations",
    tags: [],
    permissions: ["http"],
    status: "approved",
    publisherId: "user-1",
    downloads: 42,
    rating: 4.5,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeInstalledRecord(overrides: Partial<InstalledNodeRecord> = {}): InstalledNodeRecord {
  return {
    tenantId: TENANT,
    packageId: "pkg-1",
    nodeType: "custom-node",
    version: "1.0.0",
    installedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Marketplace Routes", () => {
  let mockService: jest.Mocked<MarketplaceService>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: TENANT, role: "owner" }),
    });

    mockService = {
      listPackages:     jest.fn(),
      publishPackage:   jest.fn(),
      installPackage:   jest.fn(),
      uninstallPackage: jest.fn(),
      listInstalled:    jest.fn(),
      approvePackage:   jest.fn(),
      rejectPackage:    jest.fn(),
    } as unknown as jest.Mocked<MarketplaceService>;

    app = createApp({ marketplaceService: mockService });
  });

  // ── Auth guards ───────────────────────────────────────────────────────────

  it("GET /api/marketplace/nodes returns 401 without token", async () => {
    const res = await request(app).get("/api/marketplace/nodes");
    expect(res.status).toBe(401);
  });

  it("POST /api/marketplace/nodes returns 401 without token", async () => {
    const res = await request(app).post("/api/marketplace/nodes").send({});
    expect(res.status).toBe(401);
  });

  it("GET /api/marketplace/installed returns 401 without token", async () => {
    const res = await request(app).get("/api/marketplace/installed");
    expect(res.status).toBe(401);
  });

  // ── GET /api/marketplace/nodes ────────────────────────────────────────────

  describe("GET /api/marketplace/nodes", () => {
    it("returns 200 with package list", async () => {
      const pkgs = [makePackage(), makePackage({ packageId: "pkg-2", nodeType: "node-2" })];
      (mockService.listPackages as jest.MockedFunction<typeof mockService.listPackages>)
        .mockResolvedValue({ items: pkgs, total: 2 });

      const res = await auth(request(app).get("/api/marketplace/nodes"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(2);
      expect(mockService.listPackages).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });

    it("forwards search/category/sort query params", async () => {
      (mockService.listPackages as jest.MockedFunction<typeof mockService.listPackages>)
        .mockResolvedValue({ items: [], total: 0 });

      await auth(
        request(app).get("/api/marketplace/nodes?search=http&category=integrations&sort=downloads&limit=10&offset=5")
      );

      expect(mockService.listPackages).toHaveBeenCalledWith(
        expect.objectContaining({ search: "http", category: "integrations", sort: "downloads", limit: 10, offset: 5 })
      );
    });

    it("returns 400 for invalid sort value", async () => {
      const res = await auth(
        request(app).get("/api/marketplace/nodes?sort=invalid")
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for negative offset", async () => {
      const res = await auth(
        request(app).get("/api/marketplace/nodes?offset=-1")
      );
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/marketplace/nodes ───────────────────────────────────────────

  describe("POST /api/marketplace/nodes", () => {
    const validBody = {
      name: "My Custom Node",
      version: "1.0.0",
      author: "Alice",
      nodeType: "my-custom-node",
      config: { nodeType: "my-custom-node", permissions: ["http"] },
    };

    it("returns 201 with created package on valid body", async () => {
      const pkg = makePackage({ status: "pending_review" });
      (mockService.publishPackage as jest.MockedFunction<typeof mockService.publishPackage>)
        .mockResolvedValue(pkg);

      const res = await auth(request(app).post("/api/marketplace/nodes").send(validBody));

      expect(res.status).toBe(201);
      expect(mockService.publishPackage).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My Custom Node", nodeType: "my-custom-node" })
      );
    });

    it("returns 400 when name is missing", async () => {
      const res = await auth(
        request(app).post("/api/marketplace/nodes").send({ ...validBody, name: undefined })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when version is not semver", async () => {
      const res = await auth(
        request(app).post("/api/marketplace/nodes").send({ ...validBody, version: "not-semver" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when nodeType has uppercase letters", async () => {
      const res = await auth(
        request(app).post("/api/marketplace/nodes").send({ ...validBody, nodeType: "MyNode" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when config is missing", async () => {
      const res = await auth(
        request(app).post("/api/marketplace/nodes").send({ ...validBody, config: undefined })
      );
      expect(res.status).toBe(400);
    });

    it("propagates service errors", async () => {
      (mockService.publishPackage as jest.MockedFunction<typeof mockService.publishPackage>)
        .mockRejectedValue(new Error("Service error"));

      const res = await auth(request(app).post("/api/marketplace/nodes").send(validBody));
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/marketplace/nodes/:id/install ───────────────────────────────

  describe("POST /api/marketplace/nodes/:id/install", () => {
    it("returns 201 with installed record", async () => {
      const record = makeInstalledRecord();
      (mockService.installPackage as jest.MockedFunction<typeof mockService.installPackage>)
        .mockResolvedValue(record);

      const res = await auth(request(app).post("/api/marketplace/nodes/pkg-1/install"));

      expect(res.status).toBe(201);
      expect(res.body.packageId).toBe("pkg-1");
      expect(mockService.installPackage).toHaveBeenCalledWith(TENANT, "pkg-1");
    });

    it("propagates service errors (e.g. NotFoundError → 404)", async () => {
      const { NotFoundError } = await import("../../shared/errors/index.js");
      (mockService.installPackage as jest.MockedFunction<typeof mockService.installPackage>)
        .mockRejectedValue(new NotFoundError("Package not found"));

      const res = await auth(request(app).post("/api/marketplace/nodes/no-pkg/install"));
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/marketplace/nodes/:id/install ─────────────────────────────

  describe("DELETE /api/marketplace/nodes/:id/install", () => {
    it("returns 204 on successful uninstall", async () => {
      (mockService.uninstallPackage as jest.MockedFunction<typeof mockService.uninstallPackage>)
        .mockResolvedValue(undefined);

      const res = await auth(request(app).delete("/api/marketplace/nodes/pkg-1/install"));

      expect(res.status).toBe(204);
      expect(mockService.uninstallPackage).toHaveBeenCalledWith(TENANT, "pkg-1");
    });

    it("propagates service errors (e.g. ValidationError → 400)", async () => {
      const { ValidationError } = await import("../../shared/errors/index.js");
      (mockService.uninstallPackage as jest.MockedFunction<typeof mockService.uninstallPackage>)
        .mockRejectedValue(new ValidationError("Not installed"));

      const res = await auth(request(app).delete("/api/marketplace/nodes/pkg-1/install"));
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/marketplace/installed ───────────────────────────────────────

  describe("GET /api/marketplace/installed", () => {
    it("returns 200 with list of installed nodes", async () => {
      const items = [makeInstalledRecord(), makeInstalledRecord({ packageId: "pkg-2", nodeType: "node-2" })];
      (mockService.listInstalled as jest.MockedFunction<typeof mockService.listInstalled>)
        .mockResolvedValue(items);

      const res = await auth(request(app).get("/api/marketplace/installed"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(mockService.listInstalled).toHaveBeenCalledWith(TENANT);
    });

    it("propagates service errors", async () => {
      (mockService.listInstalled as jest.MockedFunction<typeof mockService.listInstalled>)
        .mockRejectedValue(new Error("DB error"));

      const res = await auth(request(app).get("/api/marketplace/installed"));
      expect(res.status).toBe(500);
    });
  });
});
