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

jest.unstable_mockModule("../../config/database.js", () => ({
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

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
}));

// Workflow model mock (needed by WorkflowService via app.ts)
const mockWfFindOne = jest.fn();
const mockWfFind = jest.fn();
const mockWfCountDocuments = jest.fn().mockResolvedValue(0);
const mockWfCreate = jest.fn();
const mockWfFindOneAndUpdate = jest.fn();

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: mockWfFind,
    findOne: mockWfFindOne,
    countDocuments: mockWfCountDocuments,
    create: mockWfCreate,
    findOneAndUpdate: mockWfFindOneAndUpdate,
  },
}));

// WorkflowVersion model mock
jest.unstable_mockModule("../../modules/workflows/WorkflowVersion.model.js", () => ({
  WorkflowVersionModel: {
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }),
    findOne: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) }),
    create: jest.fn(),
    findOneAndUpdate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  },
}));

// Template model mock
const mockTemplateFind = jest.fn();
const mockTemplateFindById = jest.fn();
const mockTemplateCreate = jest.fn();
const mockTemplateFindByIdAndUpdate = jest.fn();
const mockTemplateCountDocuments = jest.fn().mockResolvedValue(0);

jest.unstable_mockModule("../../modules/templates/Template.model.js", () => ({
  TemplateModel: {
    find: mockTemplateFind,
    findById: mockTemplateFindById,
    create: mockTemplateCreate,
    findByIdAndUpdate: mockTemplateFindByIdAndUpdate,
    countDocuments: mockTemplateCountDocuments,
  },
}));

const { createApp } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER   = "user-1";
const TMPL_ID = "tmpl-abc123";
const WF_ID   = "wf-xyz456";

function token(): string {
  return jwt.sign({ userId: USER, email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function auth(req: ReturnType<typeof request.get>) {
  return req
    .set("Authorization", `Bearer ${token()}`)
    .set("X-Tenant-Id", TENANT);
}

function lean(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function makeTemplateDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:         TMPL_ID,
    name:        "GitHub Push Notification",
    description: "Notify on push",
    category:    "DevOps",
    nodes:       [],
    edges:       [],
    thumbnail:   undefined,
    author:      "platform",
    tags:        ["devops"],
    usageCount:  5,
    rating:      4,
    isPublic:    true,
    tenantId:    null,
    createdAt:   new Date("2024-01-01"),
    updatedAt:   new Date("2024-01-01"),
    ...overrides,
  };
}

function makeWfDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:       WF_ID,
    tenantId:  TENANT,
    name:      "GitHub Push Notification (copy)",
    status:    "draft",
    nodes:     [],
    edges:     [],
    variables: {},
    tags:      [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Template Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue(
      lean({ userId: USER, tenantId: TENANT, role: "owner" })
    );

    // Default: find returns query builder
    mockTemplateFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([makeTemplateDoc()]),
    });
    mockTemplateCountDocuments.mockResolvedValue(1);
    mockTemplateFindById.mockReturnValue(lean(makeTemplateDoc()));
    mockTemplateCreate.mockResolvedValue(makeTemplateDoc());
    mockTemplateFindByIdAndUpdate.mockResolvedValue(undefined);

    // Default workflow mock
    mockWfFindOne.mockReturnValue(lean(makeWfDoc()));
    mockWfCreate.mockResolvedValue(makeWfDoc());
    mockWfFind.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("GET /api/templates returns 401 without token", async () => {
    const res = await request(app).get("/api/templates");
    expect(res.status).toBe(401);
  });

  // ── GET /api/templates ─────────────────────────────────────────────────────

  it("GET /api/templates returns list with pagination", async () => {
    const res = await auth(request(app).get("/api/templates"));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
    });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].name).toBe("GitHub Push Notification");
  });

  it("GET /api/templates?category=DevOps returns filtered results", async () => {
    const res = await auth(request(app).get("/api/templates?category=DevOps"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /api/templates?search=github returns search results", async () => {
    const res = await auth(request(app).get("/api/templates?search=github"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it("GET /api/templates returns public + tenant private templates", async () => {
    const publicTemplate  = makeTemplateDoc({ tenantId: null, isPublic: true });
    const privateTemplate = makeTemplateDoc({ _id: "tmpl-2", tenantId: TENANT, isPublic: false });

    mockTemplateFind.mockReturnValue({
      sort:  jest.fn().mockReturnThis(),
      skip:  jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean:  jest.fn().mockResolvedValue([publicTemplate, privateTemplate]),
    });
    mockTemplateCountDocuments.mockResolvedValue(2);

    const res = await auth(request(app).get("/api/templates"));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  // ── GET /api/templates/:id ─────────────────────────────────────────────────

  it("GET /api/templates/:id returns template with nodes and edges", async () => {
    const res = await auth(request(app).get(`/api/templates/${TMPL_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TMPL_ID);
    expect(res.body.name).toBe("GitHub Push Notification");
  });

  it("GET /api/templates/:id returns 404 when not found", async () => {
    mockTemplateFindById.mockReturnValue(lean(null));
    const res = await auth(request(app).get("/api/templates/missing-id"));
    expect(res.status).toBe(404);
  });

  // ── POST /api/templates/:id/clone ─────────────────────────────────────────

  it("POST /api/templates/:id/clone creates workflow in tenant", async () => {
    const res = await auth(request(app).post(`/api/templates/${TMPL_ID}/clone`));
    expect(res.status).toBe(201);
    expect(res.body.workflowId).toBe(WF_ID);
    expect(typeof res.body.name).toBe("string");
  });

  it("POST /api/templates/:id/clone returns 404 for missing template", async () => {
    mockTemplateFindById.mockReturnValue(lean(null));
    const res = await auth(request(app).post("/api/templates/missing/clone"));
    expect(res.status).toBe(404);
  });

  it("POST /api/templates/:id/clone returns 403 for other tenant private template", async () => {
    const otherTenantTemplate = makeTemplateDoc({ tenantId: "other-tenant", isPublic: false });
    mockTemplateFindById.mockReturnValue(lean(otherTenantTemplate));

    const res = await auth(request(app).post(`/api/templates/${TMPL_ID}/clone`));
    expect(res.status).toBe(403);
  });

  // ── POST /api/templates (publish) ─────────────────────────────────────────

  it("POST /api/templates publishes workflow as private template", async () => {
    const wfDoc    = makeWfDoc({ _id: WF_ID, name: "My Workflow" });
    const tmplDoc  = makeTemplateDoc({ tenantId: TENANT, isPublic: false, name: "My Workflow" });

    mockWfFindOne.mockReturnValue(lean(wfDoc));
    mockTemplateCreate.mockResolvedValue(tmplDoc);

    const res = await auth(request(app)
      .post("/api/templates")
      .send({ workflowId: WF_ID, category: "DevOps", isPublic: false }));

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("My Workflow");
  });

  it("POST /api/templates returns 400 when workflowId is missing", async () => {
    const res = await auth(request(app)
      .post("/api/templates")
      .send({ category: "DevOps" }));
    expect(res.status).toBe(400);
  });
});
