import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockPgConnect = jest
  .fn<() => Promise<{ query: jest.Mock; release: jest.Mock }>>()
  .mockResolvedValue({
    query: jest.fn<() => Promise<{ rows: unknown[] }>>().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });

jest.unstable_mockModule("../../../config/database.js", () => ({
  pgPool: { connect: mockPgConnect, query: jest.fn() },
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

const mockFindOneTenant = jest
  .fn()
  .mockReturnValue({
    lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "owner" }),
  });

jest.unstable_mockModule("../../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
}));

// Credential model mocks
const mockCredCreate = jest.fn();
const mockCredFind = jest.fn();
const mockCredFindOne = jest.fn();
const mockCredFindOneAndUpdate = jest.fn();
const mockCredDeleteOne = jest.fn();

jest.unstable_mockModule("../../../modules/credentials/Credential.model.js", () => ({
  CredentialModel: {
    create: mockCredCreate,
    find: mockCredFind,
    findOne: mockCredFindOne,
    findOneAndUpdate: mockCredFindOneAndUpdate,
    deleteOne: mockCredDeleteOne,
  },
}));

const { createApp } = await import("../../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER = "user-1";

function token(): string {
  return jwt.sign({ userId: USER, email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function auth(req: ReturnType<typeof request.agent>) {
  return req
    .set("Authorization", `Bearer ${token()}`)
    .set("X-Tenant-Id", TENANT);
}

// A valid encrypted payload (values don't matter for mocked DB)
const MASTER_KEY = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";
function fakeEncrypted() {
  return { iv: "aabbccddee112233aabbccdd", tag: "a".repeat(32), ciphertext: "deadbeef" };
}

function makeDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "cred-1",
    tenantId: TENANT,
    name: "stripe-key",
    type: "bearer",
    encrypted: fakeEncrypted(),
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function lean(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Credential Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore tenant mock
    mockFindOneTenant.mockReturnValue(
      lean({ userId: USER, tenantId: TENANT, role: "owner" })
    );
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guards ──────────────────────────────────────────────────────────────

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/credentials");
    expect(res.status).toBe(401);
  });

  it("returns 401 without tenant header", async () => {
    const res = await request(app)
      .get("/api/credentials")
      .set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(401);
  });

  // ── POST /api/credentials ─────────────────────────────────────────────────

  describe("POST /api/credentials", () => {
    it("creates a credential and returns 201 with masked response", async () => {
      const doc = makeDoc();
      mockCredCreate.mockResolvedValue(doc);

      const res = await auth(request(app).post("/api/credentials")).send({
        name: "stripe-key",
        type: "bearer",
        data: { token: "sk_live_secret" },
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name", "stripe-key");
      expect(res.body).toHaveProperty("type", "bearer");
      expect(res.body).not.toHaveProperty("data");
      expect(res.body).not.toHaveProperty("encrypted");
    });

    it("returns 400 when name is missing", async () => {
      const res = await auth(request(app).post("/api/credentials")).send({
        type: "bearer",
        data: { token: "secret" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when type is invalid", async () => {
      const res = await auth(request(app).post("/api/credentials")).send({
        name: "key",
        type: "invalid_type",
        data: { token: "secret" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when data is missing", async () => {
      const res = await auth(request(app).post("/api/credentials")).send({
        name: "key",
        type: "bearer",
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/credentials ──────────────────────────────────────────────────

  describe("GET /api/credentials", () => {
    it("returns list without encrypted data", async () => {
      mockCredFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([makeDoc()]),
      });

      const res = await auth(request(app).get("/api/credentials"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).not.toHaveProperty("encrypted");
      expect(res.body.items[0]).not.toHaveProperty("data");
    });

    it("returns empty list when no credentials", async () => {
      mockCredFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await auth(request(app).get("/api/credentials"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ── GET /api/credentials/:id ──────────────────────────────────────────────

  describe("GET /api/credentials/:id", () => {
    it("returns credential summary without data field", async () => {
      mockCredFindOne.mockReturnValue(lean(makeDoc()));

      const res = await auth(request(app).get("/api/credentials/cred-1"));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body).not.toHaveProperty("data");
      expect(res.body).not.toHaveProperty("encrypted");
    });

    it("returns 404 when not found", async () => {
      mockCredFindOne.mockReturnValue(lean(null));

      const res = await auth(request(app).get("/api/credentials/ghost"));

      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/credentials/:id ──────────────────────────────────────────────

  describe("PUT /api/credentials/:id", () => {
    it("updates and returns masked credential", async () => {
      const updated = makeDoc({ name: "updated-key" });
      mockCredFindOneAndUpdate.mockReturnValue(lean(updated));

      const res = await auth(request(app).put("/api/credentials/cred-1")).send({
        name: "updated-key",
        data: { token: "new-secret" },
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("updated-key");
      expect(res.body).not.toHaveProperty("encrypted");
    });

    it("returns 404 when credential not found", async () => {
      mockCredFindOneAndUpdate.mockReturnValue(lean(null));

      const res = await auth(request(app).put("/api/credentials/ghost")).send({
        name: "x",
      });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/credentials/:id ───────────────────────────────────────────

  describe("DELETE /api/credentials/:id", () => {
    it("deletes credential and returns 204", async () => {
      mockCredDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await auth(request(app).delete("/api/credentials/cred-1"));

      expect(res.status).toBe(204);
    });

    it("returns 404 when credential not found", async () => {
      mockCredDeleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await auth(request(app).delete("/api/credentials/ghost"));

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/credentials/:id/test ───────────────────────────────────────

  describe("POST /api/credentials/:id/test", () => {
    it("returns ok:true with credential type", async () => {
      mockCredFindOne.mockReturnValue(lean(makeDoc()));

      const res = await auth(request(app).post("/api/credentials/cred-1/test"));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, type: "bearer", name: "stripe-key" });
    });

    it("returns 404 when credential not found", async () => {
      mockCredFindOne.mockReturnValue(lean(null));

      const res = await auth(request(app).post("/api/credentials/ghost/test"));

      expect(res.status).toBe(404);
    });
  });
});
