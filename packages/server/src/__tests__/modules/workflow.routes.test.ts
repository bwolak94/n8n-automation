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

// ─── Module mocks (before any dynamic imports) ────────────────────────────────

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

// TenantMember mock — returns owner by default
const mockFindOneTenant = jest
  .fn()
  .mockReturnValue({
    lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "owner" }),
  });

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
}));

// Workflow model mocks
const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockCountDocuments = jest.fn();
const mockCreate = jest.fn();
const mockFindOneAndUpdate = jest.fn();

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: mockFind,
    findOne: mockFindOne,
    countDocuments: mockCountDocuments,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}));

const { createApp } = await import("../../app.js");

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

const mockWorkflow = {
  _id: "wf-1",
  tenantId: TENANT,
  name: "My Workflow",
  description: "desc",
  status: "draft",
  nodes: [],
  edges: [],
  variables: {},
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function leanReturning(value: unknown) {
  return { lean: jest.fn().mockResolvedValue(value) };
}

function chainedFind(docs: unknown[], count: number) {
  const chain = {
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
  mockFind.mockReturnValue(chain);
  mockCountDocuments.mockResolvedValue(count);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Workflow Routes", () => {
  let app: ReturnType<typeof createApp>;

  const mockQueue = {
    enqueue: jest.fn<() => Promise<string>>().mockResolvedValue("job-1"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOneTenant.mockReturnValue(
      leanReturning({ userId: USER, tenantId: TENANT, role: "owner" })
    );
    app = createApp({ workflowQueue: mockQueue });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Auth guards ──────────────────────────────────────────────────────────────

  it("GET /api/workflows returns 401 without token", async () => {
    const res = await request(app).get("/api/workflows");
    expect(res.status).toBe(401);
  });

  it("GET /api/workflows returns 401 with malformed token", async () => {
    const res = await request(app)
      .get("/api/workflows")
      .set("Authorization", "Bearer bad-token")
      .set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(401);
  });

  it("GET /api/workflows returns 401 when X-Tenant-Id is missing", async () => {
    const res = await request(app)
      .get("/api/workflows")
      .set("Authorization", `Bearer ${token()}`);
    expect(res.status).toBe(401);
  });

  // ── GET /api/workflows ───────────────────────────────────────────────────────

  describe("GET /api/workflows", () => {
    it("returns paginated list of workflows", async () => {
      chainedFind([mockWorkflow], 1);

      const res = await auth(request(app).get("/api/workflows"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.offset).toBe(0);
    });

    it("respects custom limit and offset", async () => {
      chainedFind([], 0);

      const res = await auth(request(app).get("/api/workflows?limit=5&offset=10"));

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(5);
      expect(res.body.offset).toBe(10);
    });

    it("maps workflow _id to id in response", async () => {
      chainedFind([mockWorkflow], 1);

      const res = await auth(request(app).get("/api/workflows"));

      expect(res.body.items[0]).toHaveProperty("id");
      expect(res.body.items[0]).not.toHaveProperty("_id");
    });
  });

  // ── GET /api/workflows/:id ───────────────────────────────────────────────────

  describe("GET /api/workflows/:id", () => {
    it("returns 200 with workflow data", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockWorkflow));

      const res = await auth(request(app).get("/api/workflows/wf-1"));

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("My Workflow");
    });

    it("returns 404 when workflow does not exist", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      const res = await auth(request(app).get("/api/workflows/missing-id"));

      expect(res.status).toBe(404);
    });
  });

  // ── POST /api/workflows ──────────────────────────────────────────────────────

  describe("POST /api/workflows", () => {
    const validBody = {
      name: "New Workflow",
      nodes: [],
      edges: [],
      tags: [],
    };

    it("creates a workflow and returns 201", async () => {
      mockCreate.mockResolvedValue({ ...mockWorkflow, name: "New Workflow" });

      const res = await auth(request(app).post("/api/workflows")).send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("New Workflow");
    });

    it("returns 400 when name is missing", async () => {
      const res = await auth(request(app).post("/api/workflows")).send({
        nodes: [],
        edges: [],
      });

      expect(res.status).toBe(400);
    });
  });

  // ── PUT /api/workflows/:id ───────────────────────────────────────────────────

  describe("PUT /api/workflows/:id", () => {
    it("updates a workflow and returns the updated doc", async () => {
      const updated = { ...mockWorkflow, name: "Updated Name" };
      mockFindOneAndUpdate.mockReturnValue(leanReturning(updated));

      const res = await auth(request(app).put("/api/workflows/wf-1")).send({
        name: "Updated Name",
      });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    it("returns 404 when workflow does not exist", async () => {
      mockFindOneAndUpdate.mockReturnValue(leanReturning(null));

      const res = await auth(request(app).put("/api/workflows/missing")).send({
        name: "X",
      });

      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/workflows/:id (soft delete) ──────────────────────────────────

  describe("DELETE /api/workflows/:id", () => {
    it("soft-deletes a workflow and returns 204", async () => {
      mockFindOneAndUpdate.mockResolvedValue(mockWorkflow);

      const res = await auth(request(app).delete("/api/workflows/wf-1"));

      expect(res.status).toBe(204);
    });

    it("returns 404 when workflow does not exist", async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);

      const res = await auth(request(app).delete("/api/workflows/ghost"));

      expect(res.status).toBe(404);
    });

    it("soft-deleted workflow returns 404 on subsequent GET", async () => {
      // First call: soft-delete succeeds
      mockFindOneAndUpdate.mockResolvedValue(mockWorkflow);
      await auth(request(app).delete("/api/workflows/wf-1"));

      // Second call: findOne returns null (deleted)
      mockFindOne.mockReturnValue(leanReturning(null));
      const res = await auth(request(app).get("/api/workflows/wf-1"));

      expect(res.status).toBe(404);
    });
  });

  // ── Error propagation (catch branches) ──────────────────────────────────────

  describe("error propagation", () => {
    it("GET /api/workflows propagates DB errors through error handler", async () => {
      mockFind.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      const res = await auth(request(app).get("/api/workflows"));

      expect(res.status).toBe(500);
    });

    it("POST /api/workflows propagates DB errors through error handler", async () => {
      mockCreate.mockRejectedValue(new Error("DB error"));

      const res = await auth(request(app).post("/api/workflows")).send({
        name: "New Workflow",
        nodes: [],
        edges: [],
      });

      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/workflows/:id/execute ─────────────────────────────────────────

  describe("POST /api/workflows/:id/execute", () => {
    it("enqueues a job and returns 202 with jobId", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockWorkflow));

      const res = await auth(request(app).post("/api/workflows/wf-1/execute")).send({
        payload: "data",
      });

      expect(res.status).toBe(202);
      expect(res.body.jobId).toBe("job-1");
      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        "wf-1",
        expect.objectContaining({ payload: "data" }),
        TENANT
      );
    });

    it("returns 404 when workflow does not exist", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      const res = await auth(request(app).post("/api/workflows/missing/execute")).send({});

      expect(res.status).toBe(404);
    });

    it("returns 500 when no queue is configured", async () => {
      const noQueueApp = createApp({ workflowQueue: null });

      const res = await auth(
        request(noQueueApp).post("/api/workflows/wf-1/execute")
      ).send({});

      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/workflows/:id/executions ───────────────────────────────────────

  describe("GET /api/workflows/:id/executions", () => {
    it("lists executions for a workflow", async () => {
      mockFindOne.mockReturnValue(leanReturning(mockWorkflow));

      // pg query mock: executions list + count
      const mockPgQuery = jest
        .fn<() => Promise<{ rows: unknown[]; rowCount: number }>>()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // executions
        .mockResolvedValueOnce({ rows: [{ count: "0" }], rowCount: 1 }); // count

      (app as unknown as { _pgQuery?: jest.Mock })._pgQuery = mockPgQuery;

      // Override pgPool.query in the execution repo via database mock
      const dbMod = await import("../../config/database.js");
      (dbMod.pgPool as unknown as { query: jest.Mock }).query = mockPgQuery;

      const res = await auth(
        request(app).get("/api/workflows/wf-1/executions")
      );

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
    });

    it("returns 404 when workflow does not exist", async () => {
      mockFindOne.mockReturnValue(leanReturning(null));

      const res = await auth(
        request(app).get("/api/workflows/missing/executions")
      );

      expect(res.status).toBe(404);
    });
  });
});
