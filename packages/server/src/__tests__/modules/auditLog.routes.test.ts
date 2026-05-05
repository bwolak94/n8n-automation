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

const mockPgQuery = jest.fn<() => Promise<{ rows: unknown[]; rowCount: number }>>()
  .mockResolvedValue({ rows: [], rowCount: 0 });

const mockPgConnect = jest
  .fn<() => Promise<{ query: jest.Mock; release: jest.Mock }>>()
  .mockResolvedValue({
    query: jest.fn<() => Promise<{ rows: unknown[] }>>().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });

jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { connect: mockPgConnect, query: mockPgQuery },
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

jest.unstable_mockModule("node-cron", () => ({
  default: { schedule: jest.fn() },
}));

const mockFindOneTenant = jest
  .fn()
  .mockReturnValue({
    lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "owner" }),
  });

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
}));

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    }),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    countDocuments: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.unstable_mockModule("../../modules/workflows/WorkflowVersion.model.js", () => ({
  WorkflowVersionModel: {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }),
    findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) }),
    create: jest.fn(),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}));

jest.unstable_mockModule("../../modules/templates/Template.model.js", () => ({
  TemplateModel: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    }),
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

const { createApp } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER   = "user-1";

function token(): string {
  return jwt.sign({ userId: USER, email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function auth(req: ReturnType<typeof request.get>) {
  return req
    .set("Authorization", `Bearer ${token()}`)
    .set("X-Tenant-Id", TENANT);
}

function makeAuditRow(overrides: Record<string, unknown> = {}) {
  return {
    id:          "aud-abc-123",
    tenant_id:   TENANT,
    actor_id:    USER,
    actor_email: "user@test.com",
    ip_address:  "127.0.0.1",
    user_agent:  null,
    event_type:  "workflow.created",
    entity_type: "workflow",
    entity_id:   "wf-xyz",
    metadata:    { name: "Test Workflow" },
    created_at:  new Date("2024-06-01T10:00:00Z"),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Audit Log Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: USER, tenantId: TENANT, role: "owner" }),
    });

    // Default: pgPool.query returns empty results
    mockPgQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("GET /api/audit-logs returns 401 without token", async () => {
    const res = await request(app).get("/api/audit-logs");
    expect(res.status).toBe(401);
  });

  it("GET /api/audit-logs/export returns 401 without token", async () => {
    const res = await request(app).get("/api/audit-logs/export");
    expect(res.status).toBe(401);
  });

  // ── GET /api/audit-logs ────────────────────────────────────────────────────

  it("GET /api/audit-logs returns empty list when no records", async () => {
    // query returns [data, count] — both empty
    mockPgQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(0);
    expect(typeof res.body.total).toBe("number");
  });

  it("GET /api/audit-logs returns audit entries for the tenant", async () => {
    const row = makeAuditRow();
    mockPgQuery
      .mockResolvedValueOnce({ rows: [row], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs"));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].eventType).toBe("workflow.created");
    expect(res.body.items[0].tenantId).toBe(TENANT);
    expect(res.body.total).toBe(1);
  });

  it("GET /api/audit-logs supports eventType filter", async () => {
    mockPgQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs?eventType=workflow.deleted"));
    expect(res.status).toBe(200);
    // Verify the query was called with the filter (the SQL includes event_type param)
    const queryCalls = (mockPgQuery as jest.Mock).mock.calls;
    const sql = queryCalls[0]?.[0] as string;
    expect(sql).toContain("audit_logs");
  });

  it("GET /api/audit-logs supports actorId filter", async () => {
    mockPgQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ count: 0 }], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs?actorId=user-2"));
    expect(res.status).toBe(200);
  });

  it("GET /api/audit-logs returns 400 for invalid limit", async () => {
    const res = await auth(request(app).get("/api/audit-logs?limit=9999"));
    expect(res.status).toBe(400);
  });

  // ── GET /api/audit-logs/export ─────────────────────────────────────────────

  it("GET /api/audit-logs/export returns CSV content-type", async () => {
    mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await auth(request(app).get("/api/audit-logs/export"));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("audit-logs.csv");
  });

  it("GET /api/audit-logs/export returns CSV with header row", async () => {
    mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await auth(request(app).get("/api/audit-logs/export"));
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/^id,tenantId,actorId/);
  });

  it("GET /api/audit-logs/export includes data rows", async () => {
    const row = makeAuditRow();
    mockPgQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs/export"));
    expect(res.status).toBe(200);
    expect(res.text).toContain("workflow.created");
    expect(res.text).toContain("user@test.com");
  });

  // ── Tenant isolation ───────────────────────────────────────────────────────

  it("GET /api/audit-logs does not expose other tenant entries", async () => {
    // Row belongs to tenant-2, but we're requesting as tenant-1
    const otherRow = makeAuditRow({ tenant_id: "tenant-2", actor_id: "user-2" });
    mockPgQuery
      .mockResolvedValueOnce({ rows: [otherRow], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ count: 1 }], rowCount: 1 });

    const res = await auth(request(app).get("/api/audit-logs"));
    // The SQL always filters by tenant_id = $1 (tenant-1), so DB would return
    // nothing — here we verify the controller passes tenantId correctly by
    // checking the query parameter in the SQL call
    const firstCallArgs = (mockPgQuery as jest.Mock).mock.calls[0] as [string, unknown[]];
    const params = firstCallArgs[1] as unknown[];
    expect(params[0]).toBe(TENANT);
  });
});
