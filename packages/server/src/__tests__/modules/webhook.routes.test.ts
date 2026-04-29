import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { WebhookController } from "../../modules/webhooks/WebhookController.js";
import { createWebhookRouter } from "../../modules/webhooks/webhook.router.js";
import { errorHandler } from "../../shared/middleware/errorHandler.js";
import type { WorkflowRepository } from "../../modules/workflows/WorkflowRepository.js";
import type { ApiWorkflow } from "../../modules/workflows/WorkflowRepository.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockWorkflow: ApiWorkflow = {
  id: "wf-1",
  tenantId: "tenant-1",
  name: "Webhook Workflow",
  status: "active",
  nodes: [
    {
      id: "node-1",
      type: "webhook",
      category: "triggers",
      label: "Webhook",
      position: { x: 0, y: 0 },
      config: { path: "my-hook", method: "POST" },
    },
  ],
  edges: [],
  variables: {},
  tags: [],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function makeRepoMock(workflow: ApiWorkflow | null = mockWorkflow): WorkflowRepository & {
  findByIdForWebhook: jest.Mock;
} {
  return {
    findById: jest.fn(),
    findAll: jest.fn(),
    findByIdApi: jest.fn(),
    findByIdForWebhook: jest.fn<WorkflowRepository["findByIdForWebhook"]>().mockResolvedValue(workflow),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as WorkflowRepository & { findByIdForWebhook: jest.Mock };
}

function buildApp(
  repo: WorkflowRepository,
  queue: { enqueue: jest.Mock } | null = null,
  rateLimitOptions?: { max: number; windowMs: number }
) {
  const app = express();
  app.use(express.json());

  const controller = new WebhookController(repo, queue as { enqueue(): Promise<string> } | null);
  app.use("/api/webhooks", createWebhookRouter(controller, { rateLimit: rateLimitOptions }));
  app.use(errorHandler);

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Webhook Routes", () => {
  const mockEnqueue = jest.fn<() => Promise<string>>().mockResolvedValue("job-1");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/webhooks/:workflowId/:path ────────────────────────────────────

  describe("POST /api/webhooks/:workflowId/:path", () => {
    it("returns 202 when workflow and path are valid", async () => {
      const app = buildApp(makeRepoMock(), { enqueue: mockEnqueue });

      const res = await request(app)
        .post("/api/webhooks/wf-1/my-hook")
        .send({ event: "test" });

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);
      expect(res.body.workflowId).toBe("wf-1");
    });

    it("enqueues a job with trigger data from the request", async () => {
      const app = buildApp(makeRepoMock(), { enqueue: mockEnqueue });

      await request(app)
        .post("/api/webhooks/wf-1/my-hook")
        .send({ userId: "u-42" });

      expect(mockEnqueue).toHaveBeenCalledWith(
        "wf-1",
        expect.objectContaining({ body: { userId: "u-42" }, method: "POST" }),
        "tenant-1"
      );
    });

    it("returns 404 when workflow does not exist", async () => {
      const app = buildApp(makeRepoMock(null), { enqueue: mockEnqueue });

      const res = await request(app).post("/api/webhooks/missing/my-hook").send({});

      expect(res.status).toBe(404);
    });

    it("returns 404 when no webhook node matches the path", async () => {
      const app = buildApp(makeRepoMock(), { enqueue: mockEnqueue });

      const res = await request(app)
        .post("/api/webhooks/wf-1/wrong-path")
        .send({});

      expect(res.status).toBe(404);
    });

    it("accepts requests without a queue configured (enqueue is skipped)", async () => {
      const app = buildApp(makeRepoMock(), null); // no queue

      const res = await request(app)
        .post("/api/webhooks/wf-1/my-hook")
        .send({});

      expect(res.status).toBe(202);
    });

    it("does not require authentication", async () => {
      const app = buildApp(makeRepoMock(), { enqueue: mockEnqueue });

      const res = await request(app)
        .post("/api/webhooks/wf-1/my-hook")
        .send({});

      expect(res.status).toBe(202);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 after exceeding the rate limit", async () => {
      const repo = makeRepoMock();
      const app = buildApp(repo, { enqueue: mockEnqueue }, { max: 1, windowMs: 60_000 });

      await request(app).post("/api/webhooks/wf-1/my-hook").send({});
      const res = await request(app).post("/api/webhooks/wf-1/my-hook").send({});

      expect(res.status).toBe(429);
    });

    it("rate-limit error body contains code TOO_MANY_REQUESTS", async () => {
      const repo = makeRepoMock();
      const app = buildApp(repo, { enqueue: mockEnqueue }, { max: 1, windowMs: 60_000 });

      await request(app).post("/api/webhooks/wf-1/my-hook").send({});
      const res = await request(app).post("/api/webhooks/wf-1/my-hook").send({});

      expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    });

    it("allows requests within the rate limit", async () => {
      const repo = makeRepoMock();
      const app = buildApp(repo, { enqueue: mockEnqueue }, { max: 5, windowMs: 60_000 });

      const res = await request(app).post("/api/webhooks/wf-1/my-hook").send({});

      expect(res.status).toBe(202);
    });

    it("second request within the limit is also accepted", async () => {
      const repo = makeRepoMock();
      const app = buildApp(repo, { enqueue: mockEnqueue }, { max: 5, windowMs: 60_000 });

      // First request creates the bucket
      await request(app).post("/api/webhooks/wf-1/my-hook").send({});
      // Second request increments count (still within limit → hits next() branch)
      const res = await request(app).post("/api/webhooks/wf-1/my-hook").send({});

      expect(res.status).toBe(202);
    });
  });
});
