import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import type { IDLQRepository, DLQEntry } from "../../modules/queue/IDLQRepository.js";

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

const mockEntry: DLQEntry = {
  id: "dlq-job-1",
  data: { workflowId: "wf-1", tenantId: TENANT, triggerData: {} },
  errorMessage: "Something failed",
  retryCount: 3,
  failedAt: new Date("2024-01-01"),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Queue Routes", () => {
  let dlqRepo: IDLQRepository & {
    list: jest.Mock;
    retry: jest.Mock;
    discard: jest.Mock;
  };
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: TENANT, role: "owner" }),
    });

    dlqRepo = {
      list: jest.fn<IDLQRepository["list"]>().mockResolvedValue({
        items: [mockEntry],
        total: 1,
      }),
      retry: jest.fn<IDLQRepository["retry"]>().mockResolvedValue(undefined),
      discard: jest.fn<IDLQRepository["discard"]>().mockResolvedValue(undefined),
    };

    app = createApp({ dlqRepository: dlqRepo });
  });

  // ── Auth guards ──────────────────────────────────────────────────────────────

  it("GET /api/queue/dlq returns 401 without token", async () => {
    const res = await request(app).get("/api/queue/dlq");
    expect(res.status).toBe(401);
  });

  // ── GET /api/queue/dlq ───────────────────────────────────────────────────────

  describe("GET /api/queue/dlq", () => {
    it("returns paginated DLQ entries", async () => {
      const res = await auth(request(app).get("/api/queue/dlq"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.items[0].id).toBe("dlq-job-1");
    });

    it("passes limit and offset to repository", async () => {
      dlqRepo.list.mockResolvedValue({ items: [], total: 0 });

      await auth(request(app).get("/api/queue/dlq?limit=5&offset=10"));

      expect(dlqRepo.list).toHaveBeenCalledWith(10, 5);
    });

    it("DLQ entry contains errorMessage, retryCount and failedAt", async () => {
      const res = await auth(request(app).get("/api/queue/dlq"));

      const entry = res.body.items[0] as DLQEntry;
      expect(entry.errorMessage).toBe("Something failed");
      expect(entry.retryCount).toBe(3);
      expect(entry).toHaveProperty("failedAt");
    });

    it("returns empty list when DLQ is empty", async () => {
      dlqRepo.list.mockResolvedValue({ items: [], total: 0 });

      const res = await auth(request(app).get("/api/queue/dlq"));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  // ── POST /api/queue/dlq/:jobId/retry ─────────────────────────────────────────

  describe("POST /api/queue/dlq/:jobId/retry", () => {
    it("retries a DLQ job and returns 204", async () => {
      const res = await auth(request(app).post("/api/queue/dlq/dlq-job-1/retry"));

      expect(res.status).toBe(204);
      expect(dlqRepo.retry).toHaveBeenCalledWith("dlq-job-1");
    });

    it("returns 404 when job is not found", async () => {
      dlqRepo.retry.mockRejectedValue(new Error("job not found"));

      const res = await auth(request(app).post("/api/queue/dlq/missing-job/retry"));

      expect(res.status).toBe(404);
    });

    it("returns 401 without token", async () => {
      const res = await request(app).post("/api/queue/dlq/job-1/retry");
      expect(res.status).toBe(401);
    });

    it("passes unexpected errors to the error handler", async () => {
      dlqRepo.retry.mockRejectedValue(new Error("DB connection lost"));

      const res = await auth(request(app).post("/api/queue/dlq/job-1/retry"));

      expect(res.status).toBe(500);
    });
  });

  // ── DELETE /api/queue/dlq/:jobId ─────────────────────────────────────────────

  describe("DELETE /api/queue/dlq/:jobId", () => {
    it("discards a DLQ job and returns 204", async () => {
      const res = await auth(request(app).delete("/api/queue/dlq/dlq-job-1"));

      expect(res.status).toBe(204);
      expect(dlqRepo.discard).toHaveBeenCalledWith("dlq-job-1");
    });

    it("returns 404 when job is not found", async () => {
      dlqRepo.discard.mockRejectedValue(new Error("job not found"));

      const res = await auth(request(app).delete("/api/queue/dlq/missing-job"));

      expect(res.status).toBe(404);
    });

    it("returns 401 without token", async () => {
      const res = await request(app).delete("/api/queue/dlq/job-1");
      expect(res.status).toBe(401);
    });

    it("passes unexpected errors to the error handler", async () => {
      dlqRepo.discard.mockRejectedValue(new Error("DB connection lost"));

      const res = await auth(request(app).delete("/api/queue/dlq/job-1"));

      expect(res.status).toBe(500);
    });
  });

  // ── No DLQ repository configured ─────────────────────────────────────────────

  it("returns 404 when DLQ repo is not configured", async () => {
    const noQueueApp = createApp();

    const res = await auth(
      request(noQueueApp).get("/api/queue/dlq")
    );

    expect(res.status).toBe(404);
  });
});
