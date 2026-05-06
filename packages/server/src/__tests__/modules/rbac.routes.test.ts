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

// Default member: viewer role (minimal permissions)
const mockFindOneTenant = jest.fn().mockReturnValue({
  lean: jest.fn().mockResolvedValue({
    userId: "user-1",
    tenantId: "tenant-1",
    role: "viewer",
    customPermissions: undefined,
  }),
});

const mockTenantMemberFind = jest.fn().mockReturnValue({
  lean: jest.fn().mockResolvedValue([]),
});

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: {
    findOne: mockFindOneTenant,
    find: mockTenantMemberFind,
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
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
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    }),
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    }),
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

jest.unstable_mockModule("../../modules/credentials/Credential.model.js", () => ({
  CredentialModel: {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}));

const { createApp } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER   = "user-1";

function makeToken(): string {
  return jwt.sign({ userId: USER, email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function withAuth(req: ReturnType<typeof request.get>) {
  return req
    .set("Authorization", `Bearer ${makeToken()}`)
    .set("X-Tenant-Id", TENANT);
}

function setRole(role: string, customPermissions?: string[]): void {
  mockFindOneTenant.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      userId: USER,
      tenantId: TENANT,
      role,
      customPermissions: customPermissions ?? undefined,
    }),
  });
  mockTenantMemberFind.mockReturnValue({
    lean: jest.fn().mockResolvedValue([]),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RBAC — workflow routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("viewer can GET /api/workflows (workflow:read)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).get("/api/workflows"));
    expect(res.status).toBe(200);
  });

  it("viewer cannot POST /api/workflows (workflow:create)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).post("/api/workflows"))
      .send({ name: "test", nodes: [], edges: [] });
    expect(res.status).toBe(403);
  });

  it("editor can POST /api/workflows (workflow:create)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).post("/api/workflows"))
      .send({ name: "Test Workflow", nodes: [], edges: [] });
    // Auth passed if we don't get 401 or 403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("viewer cannot DELETE /api/workflows/:id (workflow:delete)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).delete("/api/workflows/wf-123"));
    expect(res.status).toBe(403);
  });

  it("editor can DELETE /api/workflows/:id (workflow:delete)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).delete("/api/workflows/wf-123"));
    // 404 (not found) means auth passed
    expect(res.status).not.toBe(403);
  });

  it("viewer cannot POST /api/workflows/:id/execute (workflow:execute)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).post("/api/workflows/wf-123/execute")).send({});
    expect(res.status).toBe(403);
  });
});

describe("RBAC — credential routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("editor can GET /api/credentials (credential:read)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).get("/api/credentials"));
    expect(res.status).toBe(200);
  });

  it("viewer cannot GET /api/credentials (no credential:read)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).get("/api/credentials"));
    expect(res.status).toBe(403);
  });

  it("editor cannot POST /api/credentials (credential:create not in editor perms)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).post("/api/credentials"))
      .send({ name: "Test", type: "http_basic", data: {} });
    expect(res.status).toBe(403);
  });

  it("admin can POST /api/credentials (credential:create)", async () => {
    setRole("admin");
    const res = await withAuth(request(app).post("/api/credentials"))
      .send({ name: "Test", type: "http_basic", data: { username: "u", password: "p" } });
    // 201 or 400 — not 403
    expect(res.status).not.toBe(403);
  });
});

describe("RBAC — execution routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("viewer can GET /api/executions/:id (execution:read)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).get("/api/executions/exec-1"));
    // 404 (not found) means auth passed
    expect(res.status).not.toBe(403);
  });

  it("viewer cannot POST /api/executions/:id/cancel (execution:cancel)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).post("/api/executions/exec-1/cancel")).send({});
    expect(res.status).toBe(403);
  });

  it("editor can POST /api/executions/:id/cancel (execution:cancel)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).post("/api/executions/exec-1/cancel")).send({});
    expect(res.status).not.toBe(403);
  });
});

describe("RBAC — member routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("viewer cannot GET /api/members (no member:invite)", async () => {
    setRole("viewer");
    const res = await withAuth(request(app).get("/api/members"));
    expect(res.status).toBe(403);
  });

  it("admin can GET /api/members (member:invite)", async () => {
    setRole("admin");
    const res = await withAuth(request(app).get("/api/members"));
    expect(res.status).toBe(200);
  });

  it("editor cannot POST /api/members/invite (no member:invite)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).post("/api/members/invite"))
      .send({ email: "new@example.com", role: "viewer" });
    expect(res.status).toBe(403);
  });

  it("admin can POST /api/members/invite (member:invite)", async () => {
    setRole("admin");
    const res = await withAuth(request(app).post("/api/members/invite"))
      .send({ email: "new@example.com", role: "viewer" });
    expect(res.status).not.toBe(403);
  });

  it("editor cannot PATCH /:userId/role (no member:changeRole)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).patch("/api/members/user-2/role"))
      .send({ role: "viewer" });
    expect(res.status).toBe(403);
  });

  it("admin can PATCH /:userId/role (member:changeRole)", async () => {
    setRole("admin");
    const res = await withAuth(request(app).patch("/api/members/user-2/role"))
      .send({ role: "viewer" });
    expect(res.status).not.toBe(403);
  });

  it("editor cannot DELETE /:userId (no member:remove)", async () => {
    setRole("editor");
    const res = await withAuth(request(app).delete("/api/members/user-2"));
    expect(res.status).toBe(403);
  });
});

describe("RBAC — customPermissions override", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  afterEach(() => { jest.clearAllMocks(); });

  it("viewer with customPermissions=[workflow:read,credential:read] can read credentials", async () => {
    setRole("viewer", ["workflow:read", "credential:read"]);
    const res = await withAuth(request(app).get("/api/credentials"));
    expect(res.status).toBe(200);
  });

  it("admin with customPermissions=[workflow:read] is denied billing-level endpoints", async () => {
    // admin + customPermissions override means only workflow:read is allowed
    setRole("admin", ["workflow:read"]);
    const res = await withAuth(request(app).get("/api/credentials"));
    // credential:read not in custom list → 403
    expect(res.status).toBe(403);
  });
});
