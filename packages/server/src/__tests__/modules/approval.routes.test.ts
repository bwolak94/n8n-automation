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

const mockFindOneTenant = jest.fn().mockReturnValue({
  lean: jest.fn().mockResolvedValue({ userId: "user-1", tenantId: "tenant-1", role: "owner" }),
});

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOneTenant },
}));

jest.unstable_mockModule("../../modules/workflows/Workflow.model.js", () => ({
  WorkflowModel: {
    find: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
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
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([]) }),
    findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
  },
}));

// ─── Approval service mock ─────────────────────────────────────────────────────

const mockApprovalService = {
  createApproval:      jest.fn(),
  decide:              jest.fn(),
  expireApproval:      jest.fn(),
  findById:            jest.fn(),
  findByExecutionId:   jest.fn(),
};

const { createApp } = await import("../../app.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECRET = "test-secret-super-long-string-32ch";
const TENANT = "tenant-1";
const USER   = "user-1";

function authToken(): string {
  return jwt.sign({ userId: USER, email: "user@test.com" }, SECRET, { expiresIn: "1d" });
}

function auth(req: ReturnType<typeof request.get>) {
  return req.set("Authorization", `Bearer ${authToken()}`).set("X-Tenant-Id", TENANT);
}

function approvalToken(approvalId: string, decision: "approved" | "rejected"): string {
  return jwt.sign(
    { approvalId, decision, reviewer: "alice@example.com", type: "approval" },
    SECRET,
    { expiresIn: "24h" }
  );
}

function makeApprovalRow() {
  return {
    id:             "appr-1",
    execution_id:   "exec-1",
    node_id:        "node-1",
    tenant_id:      TENANT,
    status:         "pending",
    reviewers:      ["alice@example.com"],
    decisions:      [],
    require_all:    false,
    timeout_action: "reject",
    token_hash:     "hash-abc",
    expires_at:     new Date(Date.now() + 86_400_000),
    created_at:     new Date(),
    decided_at:     null,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Approval Routes", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFindOneTenant.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ userId: USER, tenantId: TENANT, role: "owner" }),
    });

    // Default: no DB rows
    mockPgQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    // Create app with mock approval service injected
    app = createApp({ approvalService: mockApprovalService as unknown as Parameters<typeof createApp>[0]["approvalService"] });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Public action endpoints ────────────────────────────────────────────────

  it("POST /api/approvals/:id/approve returns 200 with valid token", async () => {
    const token = approvalToken("appr-1", "approved");
    (mockApprovalService.decide as jest.Mock).mockResolvedValue({
      executionId: "exec-1", tenantId: TENANT, finalDecision: "approved",
    });

    const res = await request(app)
      .post(`/api/approvals/appr-1/approve?token=${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.finalDecision).toBe("approved");
    expect(res.body.approvalId).toBe("appr-1");
  });

  it("POST /api/approvals/:id/reject returns 200 with valid token", async () => {
    const token = approvalToken("appr-1", "rejected");
    (mockApprovalService.decide as jest.Mock).mockResolvedValue({
      executionId: "exec-1", tenantId: TENANT, finalDecision: "rejected",
    });

    const res = await request(app)
      .post(`/api/approvals/appr-1/reject?token=${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.finalDecision).toBe("rejected");
  });

  it("POST /api/approvals/:id/approve returns 400 without token", async () => {
    const res = await request(app).post("/api/approvals/appr-1/approve").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/approvals/:id/reject returns 400 without token", async () => {
    const res = await request(app).post("/api/approvals/appr-1/reject").send({});
    expect(res.status).toBe(400);
  });

  it("POST approve passes comment to ApprovalService.decide()", async () => {
    const token = approvalToken("appr-1", "approved");
    (mockApprovalService.decide as jest.Mock).mockResolvedValue({
      executionId: "exec-1", tenantId: TENANT, finalDecision: "approved",
    });

    await request(app)
      .post(`/api/approvals/appr-1/approve?token=${token}`)
      .send({ comment: "Looks good!" });

    expect(mockApprovalService.decide).toHaveBeenCalledWith(
      "appr-1",
      token,
      "Looks good!"
    );
  });

  it("POST approve with AND mode pending returns 200 with finalDecision=pending", async () => {
    const token = approvalToken("appr-1", "approved");
    (mockApprovalService.decide as jest.Mock).mockResolvedValue({
      executionId: "exec-1", tenantId: TENANT, finalDecision: "pending",
    });

    const res = await request(app)
      .post(`/api/approvals/appr-1/approve?token=${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.finalDecision).toBe("pending");
  });

  // ── Authenticated read endpoints ───────────────────────────────────────────

  it("GET /api/approvals/:id requires authentication", async () => {
    const res = await request(app).get("/api/approvals/appr-1");
    expect(res.status).toBe(401);
  });

  it("GET /api/approvals/:id returns 200 with approval data", async () => {
    const approval = makeApprovalRow();
    (mockApprovalService.findById as jest.Mock).mockResolvedValue(approval);

    const res = await auth(request(app).get("/api/approvals/appr-1"));
    expect(res.status).toBe(200);
  });

  it("GET /api/executions/:id/approvals requires authentication", async () => {
    const res = await request(app).get("/api/executions/exec-1/approvals");
    expect(res.status).toBe(401);
  });

  it("GET /api/executions/:id/approvals returns list of approvals", async () => {
    (mockApprovalService.findByExecutionId as jest.Mock).mockResolvedValue([makeApprovalRow()]);

    const res = await auth(request(app).get("/api/executions/exec-1/approvals"));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });
});
