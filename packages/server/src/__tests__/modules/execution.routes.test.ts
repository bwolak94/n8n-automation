import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockPgQuery = jest.fn<() => Promise<{ rows: unknown[]; rowCount: number }>>();

jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { connect: jest.fn(), query: mockPgQuery },
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

const mockExecution = {
  id: "exec-1",
  tenantId: TENANT,
  workflowId: "wf-1",
  status: "completed",
  steps: [],
  startedAt: new Date("2024-01-01"),
  completedAt: new Date("2024-01-01"),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Execution Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  // ── Auth guards ──────────────────────────────────────────────────────────────

  it("GET /api/executions/:id returns 401 without token", async () => {
    const res = await request(app).get("/api/executions/exec-1");
    expect(res.status).toBe(401);
  });

  // ── GET /api/executions/:id ───────────────────────────────────────────────────

  describe("GET /api/executions/:id", () => {
    it("returns 200 with execution data", async () => {
      // findById: executions row + steps
      mockPgQuery
        .mockResolvedValueOnce({ rows: [{ id: "exec-1", tenant_id: TENANT, workflow_id: "wf-1", status: "completed", started_at: new Date() }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(request(app).get("/api/executions/exec-1"));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("exec-1");
    });

    it("returns 404 when execution does not exist", async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(request(app).get("/api/executions/missing"));

      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/executions/:id/logs (SSE) ───────────────────────────────────────

  describe("GET /api/executions/:id/logs", () => {
    it("returns SSE headers and closes immediately for completed execution", async () => {
      // Execution is already completed — stream should close immediately
      mockPgQuery
        .mockResolvedValueOnce({
          rows: [{ id: "exec-1", tenant_id: TENANT, workflow_id: "wf-1", status: "completed", started_at: new Date() }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(
        request(app).get("/api/executions/exec-1/logs")
      );

      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.text).toContain("event: done");
    });

    it("returns 401 without auth token", async () => {
      const res = await request(app).get("/api/executions/exec-1/logs");
      expect(res.status).toBe(401);
    });

    it("sends error event when execution is not found", async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(
        request(app).get("/api/executions/missing/logs")
      );

      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.text).toContain("EXECUTION_NOT_FOUND");
    });

    it("emits log and done events for completed execution", async () => {
      mockPgQuery
        .mockResolvedValueOnce({
          rows: [{ id: "exec-1", tenant_id: TENANT, workflow_id: "wf-1", status: "completed", started_at: new Date() }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(
        request(app).get("/api/executions/exec-1/logs")
      );

      expect(res.text).toContain("event: log");
      expect(res.text).toContain("event: done");
    });

    it("polls until running execution transitions to terminal state", async () => {
      const runningRow = {
        id: "exec-1",
        tenant_id: TENANT,
        workflow_id: "wf-1",
        status: "running",
        started_at: new Date(),
      };
      const completedRow = { ...runningRow, status: "completed" };

      // Initial lookup: running
      mockPgQuery
        .mockResolvedValueOnce({ rows: [runningRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Interval poll: completed
        .mockResolvedValueOnce({ rows: [completedRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(
        request(app).get("/api/executions/exec-1/logs")
      );

      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(res.text).toContain("event: done");
      expect(res.text).toContain("completed");
    }, 10_000);

    it("emits error event when execution disappears during polling", async () => {
      const runningRow = {
        id: "exec-1",
        tenant_id: TENANT,
        workflow_id: "wf-1",
        status: "running",
        started_at: new Date(),
      };

      // Initial lookup: running
      mockPgQuery
        .mockResolvedValueOnce({ rows: [runningRow], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        // Interval poll: execution gone
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(
        request(app).get("/api/executions/exec-1/logs")
      );

      expect(res.text).toContain("EXECUTION_NOT_FOUND");
    }, 10_000);
  });

  // ── POST /api/executions/:id/cancel ──────────────────────────────────────────

  describe("POST /api/executions/:id/cancel", () => {
    it("cancels a running execution and returns 204", async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await auth(request(app).post("/api/executions/exec-1/cancel"));

      expect(res.status).toBe(204);
    });

    it("returns 404 when execution is not cancellable", async () => {
      mockPgQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await auth(request(app).post("/api/executions/missing/cancel"));

      expect(res.status).toBe(404);
    });

    it("returns 401 without token", async () => {
      const res = await request(app).post("/api/executions/exec-1/cancel");
      expect(res.status).toBe(401);
    });
  });

  // ── Execution from workflow ───────────────────────────────────────────────────

  it("execution data includes steps array", async () => {
    mockPgQuery
      .mockResolvedValueOnce({
        rows: [{ id: "exec-1", tenant_id: TENANT, workflow_id: "wf-1", status: "running", started_at: new Date() }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: "step-1", execution_id: "exec-1", node_id: "n1", node_type: "http_request", status: "completed", attempt: 1, started_at: new Date() }],
        rowCount: 1,
      });

    const res = await auth(request(app).get("/api/executions/exec-1"));

    expect(res.body.steps).toHaveLength(1);
    expect(res.body.steps[0].nodeType).toBe("http_request");
  });
});
