import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Pool } from "pg";

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.unstable_mockModule("../../config/database.js", () => ({
  pgPool: { query: jest.fn(), connect: jest.fn() } as unknown as Pool,
  connectDatabases: jest.fn(),
  connectMongoDB: jest.fn(),
  connectPostgres: jest.fn(),
  connectWithRetry: jest.fn(),
}));

const { ExecutionLogRepository } = await import(
  "../../modules/executions/ExecutionLogRepository.js"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePool(queryImpl?: () => Promise<unknown>) {
  return {
    query: jest.fn(queryImpl) as jest.Mock,
  } as unknown as Pool;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ExecutionLogRepository", () => {
  // ── create ────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("inserts a new execution row and returns the mapped result", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: "exec-1",
            tenant_id: "t1",
            workflow_id: "wf-1",
            status: "running",
            started_at: new Date("2024-01-01"),
          },
        ],
        rowCount: 1,
      });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.create({
        tenantId: "t1",
        workflowId: "wf-1",
        status: "running",
        startedAt: new Date("2024-01-01"),
      });

      expect(result.id).toBe("exec-1");
      expect(result.tenantId).toBe("t1");
      expect(result.workflowId).toBe("wf-1");
      expect(result.status).toBe("running");
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("builds SET clause for status field", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });

      const repo = new ExecutionLogRepository(pool);
      await repo.update("exec-1", { status: "completed" });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status");
      expect(params).toContain("completed");
    });

    it("builds SET clause for completedAt field", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
      const completedAt = new Date("2024-01-02");

      const repo = new ExecutionLogRepository(pool);
      await repo.update("exec-1", { completedAt });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("completed_at");
      expect(params).toContain(completedAt);
    });

    it("builds SET clause for error field", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });

      const repo = new ExecutionLogRepository(pool);
      await repo.update("exec-1", { error: "Something failed" });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("error");
      expect(params).toContain("Something failed");
    });

    it("skips the query entirely when no fields are provided", async () => {
      const pool = makePool();

      const repo = new ExecutionLogRepository(pool);
      await repo.update("exec-1", {});

      expect(pool.query).not.toHaveBeenCalled();
    });

    it("combines multiple fields in one SET clause", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
      const completedAt = new Date();

      const repo = new ExecutionLogRepository(pool);
      await repo.update("exec-1", { status: "failed", completedAt, error: "oops" });

      const [sql] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status");
      expect(sql).toContain("completed_at");
      expect(sql).toContain("error");
    });
  });

  // ── createStep ───────────────────────────────────────────────────────────

  describe("createStep", () => {
    it("inserts a new execution_step row and returns the mapped result", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: "step-1",
            execution_id: "exec-1",
            node_id: "n1",
            node_type: "http_request",
            status: "running",
            started_at: new Date("2024-01-01"),
          },
        ],
        rowCount: 1,
      });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.createStep({
        executionId: "exec-1",
        nodeId: "n1",
        nodeType: "http_request",
        status: "running",
        startedAt: new Date("2024-01-01"),
      });

      expect(result.id).toBe("step-1");
      expect(result.executionId).toBe("exec-1");
      expect(result.nodeId).toBe("n1");
      expect(result.nodeType).toBe("http_request");
      expect(result.status).toBe("running");
    });

    it("serialises input as JSON when provided", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: "s1", execution_id: "e1", node_id: "n1", node_type: "t", status: "running", started_at: new Date() }],
        rowCount: 1,
      });

      const repo = new ExecutionLogRepository(pool);
      await repo.createStep({
        executionId: "e1",
        nodeId: "n1",
        nodeType: "t",
        status: "running",
        startedAt: new Date(),
        input: { key: "value" },
      });

      const [, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBe(JSON.stringify({ key: "value" }));
    });

    it("passes null for input when not provided", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({
        rows: [{ id: "s1", execution_id: "e1", node_id: "n1", node_type: "t", status: "running", started_at: new Date() }],
        rowCount: 1,
      });

      const repo = new ExecutionLogRepository(pool);
      await repo.createStep({ executionId: "e1", nodeId: "n1", nodeType: "t", status: "running", startedAt: new Date() });

      const [, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(params[4]).toBeNull();
    });
  });

  // ── updateStep ────────────────────────────────────────────────────────────

  describe("updateStep", () => {
    it("builds SET clause for status field", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });

      const repo = new ExecutionLogRepository(pool);
      await repo.updateStep("step-1", { status: "completed" });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status");
      expect(params).toContain("completed");
    });

    it("builds SET clause for completedAt, durationMs, output and error", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 1 });
      const completedAt = new Date();

      const repo = new ExecutionLogRepository(pool);
      await repo.updateStep("step-1", {
        status: "completed",
        completedAt,
        durationMs: 250,
        output: { result: "ok" },
        error: "some error",
      });

      const [sql, params] = (pool.query as jest.Mock).mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("completed_at");
      expect(sql).toContain("duration_ms");
      expect(sql).toContain("output");
      expect(sql).toContain("error");
      expect(params).toContain(completedAt);
      expect(params).toContain(250);
      expect(params).toContain(JSON.stringify({ result: "ok" }));
    });

    it("skips the query when no fields are provided", async () => {
      const pool = makePool();

      const repo = new ExecutionLogRepository(pool);
      await repo.updateStep("step-1", {});

      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe("cancel", () => {
    it("returns true when a row was updated", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.cancel("exec-1", "t1");

      expect(result).toBe(true);
    });

    it("returns false when no row was updated (already finished)", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rowCount: 0 });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.cancel("exec-1", "t1");

      expect(result).toBe(false);
    });

    it("handles null rowCount gracefully", async () => {
      const pool = makePool();
      (pool.query as jest.Mock).mockResolvedValue({ rowCount: null });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.cancel("exec-1", "t1");

      expect(result).toBe(false);
    });
  });

  // ── findByWorkflowId ──────────────────────────────────────────────────────

  describe("findByWorkflowId", () => {
    it("falls back to 0 when count row is missing", async () => {
      const pool = makePool();
      // Promise.all — first call = executions, second call = count
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // no count row

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.findByWorkflowId("wf-1", "t1", { limit: 10, offset: 0 });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("returns correct total when count row is present", async () => {
      const pool = makePool();
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ count: "5" }], rowCount: 1 });

      const repo = new ExecutionLogRepository(pool);
      const result = await repo.findByWorkflowId("wf-1", "t1", { limit: 10, offset: 0 });

      expect(result.total).toBe(5);
    });
  });
});
