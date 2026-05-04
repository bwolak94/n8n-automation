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

// Webhook model mocks
const mockWebhookCreate = jest.fn();
const mockWebhookFind = jest.fn();
const mockWebhookFindOne = jest.fn();
const mockWebhookDeleteOne = jest.fn();

jest.unstable_mockModule("../../../modules/webhooks/Webhook.model.js", () => ({
  WebhookModel: {
    create: mockWebhookCreate,
    find: mockWebhookFind,
    findOne: mockWebhookFindOne,
    deleteOne: mockWebhookDeleteOne,
  },
}));

// Credential model mock (needed by createApp)
jest.unstable_mockModule("../../../modules/credentials/Credential.model.js", () => ({
  CredentialModel: {
    create: jest.fn(),
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
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

function lean(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function fakeWebhookDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "wh-1",
    tenantId: TENANT,
    workflowId: "wf-1",
    webhookId: "test-uuid-1234",
    method: "ANY",
    active: true,
    createdAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Webhook Management Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOneTenant.mockReturnValue(
      lean({ userId: USER, tenantId: TENANT, role: "owner" })
    );
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guards ──────────────────────────────────────────────────────────────

  it("POST /api/webhooks returns 401 without token", async () => {
    const res = await request(app).post("/api/webhooks").send({
      workflowId: "wf-1",
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/webhooks returns 401 without token", async () => {
    const res = await request(app).get("/api/webhooks");
    expect(res.status).toBe(401);
  });

  // ── POST /api/webhooks — create ───────────────────────────────────────────

  describe("POST /api/webhooks (create)", () => {
    it("creates a webhook endpoint and returns 201 with URL", async () => {
      const doc = fakeWebhookDoc();
      mockWebhookCreate.mockResolvedValue(doc);

      const res = await auth(request(app).post("/api/webhooks")).send({
        workflowId: "wf-1",
        method: "POST",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("url");
      expect(res.body.url).toContain("/api/w/");
      expect(res.body).toHaveProperty("webhookId");
      expect(res.body).toHaveProperty("workflowId", "wf-1");
      expect(res.body).not.toHaveProperty("secret");
    });

    it("returns 400 when workflowId is missing", async () => {
      const res = await auth(request(app).post("/api/webhooks")).send({
        method: "POST",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when method is invalid", async () => {
      const res = await auth(request(app).post("/api/webhooks")).send({
        workflowId: "wf-1",
        method: "INVALID",
      });
      expect(res.status).toBe(400);
    });

    it("creates with default method ANY when method not specified", async () => {
      const doc = fakeWebhookDoc({ method: "ANY" });
      mockWebhookCreate.mockResolvedValue(doc);

      const res = await auth(request(app).post("/api/webhooks")).send({
        workflowId: "wf-1",
      });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe("ANY");
    });
  });

  // ── GET /api/webhooks — list ──────────────────────────────────────────────

  describe("GET /api/webhooks (list)", () => {
    it("returns list of webhook registrations for tenant", async () => {
      mockWebhookFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([fakeWebhookDoc()]),
      });

      const res = await auth(request(app).get("/api/webhooks"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toHaveProperty("url");
      expect(res.body.items[0]).toHaveProperty("webhookId");
      expect(res.body.items[0]).not.toHaveProperty("secret");
    });

    it("returns empty list when no webhooks registered", async () => {
      mockWebhookFind.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await auth(request(app).get("/api/webhooks"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  // ── DELETE /api/webhooks/:id ──────────────────────────────────────────────

  describe("DELETE /api/webhooks/:id", () => {
    it("deletes webhook and returns 204", async () => {
      mockWebhookDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await auth(request(app).delete("/api/webhooks/wh-1"));

      expect(res.status).toBe(204);
    });

    it("returns 404 when webhook not found", async () => {
      mockWebhookDeleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await auth(request(app).delete("/api/webhooks/ghost"));

      expect(res.status).toBe(404);
    });
  });

  // ── Incoming webhook /api/w/:webhookId — public ──────────────────────────

  describe("ALL /api/w/:webhookId (incoming — public)", () => {
    it("does not require authentication", async () => {
      // No auth needed — return 404 because no mock record
      mockWebhookFindOne.mockReturnValue(lean(null));

      const res = await request(app).post("/api/w/unknown-uuid").send("{}");

      // 404 (not 401) confirms no auth required
      expect(res.status).toBe(404);
    });

    it("returns 202 for valid incoming webhook", async () => {
      const record = fakeWebhookDoc();
      mockWebhookFindOne.mockReturnValue(lean(record));

      const res = await request(app)
        .post("/api/w/test-uuid-1234")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ event: "test" }));

      expect(res.status).toBe(202);
    });
  });
});
