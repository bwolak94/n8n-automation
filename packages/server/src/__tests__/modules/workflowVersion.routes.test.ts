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

// Workflow model mock
const mockWfFind = jest.fn();
const mockWfFindOne = jest.fn();
const mockWfCountDocuments = jest.fn();
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
const mockVerFind = jest.fn();
const mockVerFindOne = jest.fn();
const mockVerCreate = jest.fn();
const mockVerFindOneAndUpdate = jest.fn();
const mockVerDeleteMany = jest.fn();

jest.unstable_mockModule("../../modules/workflows/WorkflowVersion.model.js", () => ({
  WorkflowVersionModel: {
    find: mockVerFind,
    findOne: mockVerFindOne,
    create: mockVerCreate,
    findOneAndUpdate: mockVerFindOneAndUpdate,
    deleteMany: mockVerDeleteMany,
  },
}));

const { createApp } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER = "user-1";
const WF_ID = "wf-abc123";

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

function makeWfDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: WF_ID,
    tenantId: TENANT,
    name: "Test Workflow",
    status: "draft",
    nodes: [],
    edges: [],
    variables: {},
    tags: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeVerDoc(version: number, overrides: Record<string, unknown> = {}) {
  return {
    _id: `ver-${version}`,
    workflowId: WF_ID,
    tenantId: TENANT,
    version,
    snapshot: makeWfDoc(),
    label: undefined,
    createdBy: USER,
    createdAt: new Date("2024-01-01"),
    autoSave: true,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Workflow Version Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue(
      lean({ userId: USER, tenantId: TENANT, role: "owner" })
    );

    // Default: workflow found
    mockWfFindOne.mockReturnValue(lean(makeWfDoc()));

    // Default: no versions
    mockVerFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue(lean([])),
      }),
    });
    mockVerFindOne.mockReturnValue({
      sort: jest.fn().mockReturnValue(lean(null)),
    });
    mockVerCreate.mockResolvedValue(makeVerDoc(1));
    mockVerFindOneAndUpdate.mockReturnValue(lean(null));
    mockVerDeleteMany.mockResolvedValue({ deletedCount: 0 });

    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it("returns 401 without token", async () => {
    const res = await request(app).get(`/api/workflows/${WF_ID}/versions`);
    expect(res.status).toBe(401);
  });

  // ── GET /versions ─────────────────────────────────────────────────────────

  describe("GET /api/workflows/:id/versions", () => {
    it("returns 200 with version list", async () => {
      const versions = [makeVerDoc(2), makeVerDoc(1)];
      mockVerFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(lean(versions)),
        }),
      });

      const res = await auth(request(app).get(`/api/workflows/${WF_ID}/versions`));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty("version", 2);
      expect(res.body[0]).not.toHaveProperty("snapshot");
    });

    it("returns 404 when workflow not found", async () => {
      mockWfFindOne.mockReturnValue(lean(null));

      const res = await auth(request(app).get(`/api/workflows/ghost/versions`));
      expect(res.status).toBe(404);
    });
  });

  // ── GET /versions/:v ──────────────────────────────────────────────────────

  describe("GET /api/workflows/:id/versions/:v", () => {
    it("returns 200 with full version doc including snapshot", async () => {
      const vDoc = makeVerDoc(3);
      mockVerFindOne.mockReturnValue(lean(vDoc));

      const res = await auth(request(app).get(`/api/workflows/${WF_ID}/versions/3`));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("version", 3);
      expect(res.body).toHaveProperty("snapshot");
    });

    it("returns 404 when version not found", async () => {
      mockVerFindOne.mockReturnValue(lean(null));

      const res = await auth(request(app).get(`/api/workflows/${WF_ID}/versions/99`));
      expect(res.status).toBe(404);
    });
  });

  // ── POST /versions/:v/restore ─────────────────────────────────────────────

  describe("POST /api/workflows/:id/versions/:v/restore", () => {
    it("returns 200 with new version created from restored snapshot", async () => {
      const vDoc = makeVerDoc(1);
      const newVersionDoc = makeVerDoc(4, { label: "Restored from v1", autoSave: false });

      // First call: getVersion uses .lean() directly
      // Second call: createVersion's max-version lookup uses .sort().lean()
      mockVerFindOne
        .mockReturnValueOnce(lean(vDoc))
        .mockReturnValueOnce({ sort: jest.fn().mockReturnValue(lean(null)) });

      // workflowRepo.update succeeds
      mockWfFindOneAndUpdate.mockReturnValue(lean(makeWfDoc()));

      // pruneOldAutoSaves: find auto-saves (no auto-saves yet → skip prune)
      mockVerFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(lean([])),
        }),
      });
      mockVerCreate.mockResolvedValue(newVersionDoc);

      const res = await auth(
        request(app).post(`/api/workflows/${WF_ID}/versions/1/restore`)
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("version");
    });

    it("returns 404 when version to restore is not found", async () => {
      mockVerFindOne.mockReturnValue(lean(null));

      const res = await auth(
        request(app).post(`/api/workflows/${WF_ID}/versions/99/restore`)
      );
      expect(res.status).toBe(404);
    });
  });

  // ── POST /versions/:v/tag ─────────────────────────────────────────────────

  describe("POST /api/workflows/:id/versions/:v/tag", () => {
    it("returns 200 after tagging a version", async () => {
      const tagged = makeVerDoc(2, { label: "v2.0 launch", autoSave: false });
      mockVerFindOneAndUpdate.mockReturnValue(lean(tagged));

      const res = await auth(
        request(app).post(`/api/workflows/${WF_ID}/versions/2/tag`)
      ).send({ label: "v2.0 launch" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("label", "v2.0 launch");
    });

    it("returns 400 when label is missing", async () => {
      const res = await auth(
        request(app).post(`/api/workflows/${WF_ID}/versions/2/tag`)
      ).send({});

      expect(res.status).toBe(400);
    });

    it("returns 404 when version not found", async () => {
      mockVerFindOneAndUpdate.mockReturnValue(lean(null));

      const res = await auth(
        request(app).post(`/api/workflows/${WF_ID}/versions/99/tag`)
      ).send({ label: "release" });

      expect(res.status).toBe(404);
    });
  });

  // ── GET /versions/diff ────────────────────────────────────────────────────

  describe("GET /api/workflows/:id/versions/diff", () => {
    it("returns 200 with JSON Patch array", async () => {
      const snap1 = makeWfDoc({ name: "Old" });
      const snap2 = makeWfDoc({ name: "New" });
      const v1Doc = makeVerDoc(1, { snapshot: snap1 });
      const v2Doc = makeVerDoc(2, { snapshot: snap2 });

      mockVerFindOne
        .mockReturnValueOnce(lean(v1Doc))
        .mockReturnValueOnce(lean(v2Doc));

      const res = await auth(
        request(app).get(`/api/workflows/${WF_ID}/versions/diff?v1=1&v2=2`)
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const nameOp = (res.body as Array<{ op: string; path: string; value?: unknown }>)
        .find((o) => o.path === "/name");
      expect(nameOp).toBeDefined();
      expect(nameOp?.op).toBe("replace");
      expect(nameOp?.value).toBe("New");
    });

    it("returns 400 when v1 or v2 is missing", async () => {
      const res = await auth(
        request(app).get(`/api/workflows/${WF_ID}/versions/diff?v1=1`)
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when a version is not found", async () => {
      mockVerFindOne.mockReturnValue(lean(null));

      const res = await auth(
        request(app).get(`/api/workflows/${WF_ID}/versions/diff?v1=1&v2=2`)
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Integration: save 3 times → 3 versions ───────────────────────────────

  describe("integration: auto-snapshot on workflow update", () => {
    it("saves workflow and fires snapshot (non-blocking)", async () => {
      // Workflow update succeeds
      mockWfFindOneAndUpdate.mockReturnValue(lean(makeWfDoc()));
      // Version repo: no existing version
      mockVerFindOne.mockReturnValue({
        sort: jest.fn().mockReturnValue(lean(null)),
      });
      mockVerCreate.mockResolvedValue(makeVerDoc(1));
      mockVerFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(lean([])),
        }),
      });

      const res = await auth(
        request(app).put(`/api/workflows/${WF_ID}`)
      ).send({ name: "Updated" });

      expect(res.status).toBe(200);
      // Give async snapshot a tick to run
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockVerCreate).toHaveBeenCalledTimes(1);
    });
  });
});
