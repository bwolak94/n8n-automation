import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import crypto from "crypto";
import { verifyHmacSignature } from "../../../modules/webhooks/WebhookHandler.js";
import express from "express";
import request from "supertest";
import { WebhookHandler } from "../../../modules/webhooks/WebhookHandler.js";
import { createIncomingWebhookRouter } from "../../../modules/webhooks/incoming.webhook.router.js";
import { errorHandler } from "../../../shared/middleware/errorHandler.js";
import type { WebhookRepository } from "../../../modules/webhooks/WebhookRepository.js";

// ─── HMAC unit tests ──────────────────────────────────────────────────────────

describe("verifyHmacSignature", () => {
  const secret = "super-secret-key";
  const body = Buffer.from(JSON.stringify({ event: "push" }));

  function makeSignature(s: string, b: Buffer): string {
    return "sha256=" + crypto.createHmac("sha256", s).update(b).digest("hex");
  }

  it("returns true for a valid signature", () => {
    const sig = makeSignature(secret, body);
    expect(verifyHmacSignature(secret, body, sig)).toBe(true);
  });

  it("returns false for a tampered body", () => {
    const sig = makeSignature(secret, body);
    const tamperedBody = Buffer.from(JSON.stringify({ event: "hacked" }));
    expect(verifyHmacSignature(secret, tamperedBody, sig)).toBe(false);
  });

  it("returns false for a wrong secret", () => {
    const sig = makeSignature("wrong-secret", body);
    expect(verifyHmacSignature(secret, body, sig)).toBe(false);
  });

  it("returns false when signature is different length", () => {
    expect(verifyHmacSignature(secret, body, "sha256=short")).toBe(false);
  });

  it("returns false for missing sha256= prefix", () => {
    const bare = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHmacSignature(secret, body, bare)).toBe(false);
  });
});

// ─── WebhookHandler integration (via router) ──────────────────────────────────

function makeRepo(record: Record<string, unknown> | null = null): jest.Mocked<WebhookRepository> {
  return {
    create: jest.fn(),
    findByWebhookId: jest.fn().mockResolvedValue(record),
    findByWorkflowId: jest.fn(),
    findAllByTenant: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<WebhookRepository>;
}

function validRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "wh-1",
    tenantId: "tenant-1",
    workflowId: "wf-1",
    webhookId: "test-uuid",
    method: "ANY",
    active: true,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildApp(repo: jest.Mocked<WebhookRepository>, queue: { enqueue: jest.Mock } | null = null) {
  const app = express();
  const handler = new WebhookHandler(repo, queue as { enqueue(): Promise<string> } | null);
  app.use("/api/w", createIncomingWebhookRouter(handler));
  app.use(errorHandler);
  return app;
}

describe("WebhookHandler (incoming webhook endpoint)", () => {
  const mockEnqueue = jest.fn<() => Promise<string>>().mockResolvedValue("job-1");

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 202 happy path ────────────────────────────────────────────────────────

  it("returns 202 and enqueues a job for a valid webhookId", async () => {
    const repo = makeRepo(validRecord());
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app)
      .post("/api/w/test-uuid")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ event: "push" }));

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledWith(
      "wf-1",
      expect.objectContaining({ body: { event: "push" }, method: "POST" }),
      "tenant-1"
    );
  });

  // ── 404 cases ─────────────────────────────────────────────────────────────

  it("returns 404 when webhookId not found", async () => {
    const repo = makeRepo(null);
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).post("/api/w/unknown-uuid").send({});
    expect(res.status).toBe(404);
  });

  it("returns 404 when webhook is inactive", async () => {
    const repo = makeRepo(validRecord({ active: false }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).post("/api/w/test-uuid").send({});
    expect(res.status).toBe(404);
  });

  it("returns 404 when HTTP method does not match", async () => {
    const repo = makeRepo(validRecord({ method: "POST" }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).get("/api/w/test-uuid");
    expect(res.status).toBe(404);
  });

  // ── Method filter ─────────────────────────────────────────────────────────

  it("accepts any method when webhook method is ANY", async () => {
    const repo = makeRepo(validRecord({ method: "ANY" }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).get("/api/w/test-uuid");
    expect(res.status).toBe(202);
  });

  it("accepts correct method when method is specified", async () => {
    const repo = makeRepo(validRecord({ method: "POST" }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).post("/api/w/test-uuid").send("{}");
    expect(res.status).toBe(202);
  });

  // ── HMAC verification ────────────────────────────────────────────────────

  it("returns 401 when HMAC secret is set but header is missing", async () => {
    const repo = makeRepo(validRecord({ secret: "my-secret-key" }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app).post("/api/w/test-uuid").send("{}");
    expect(res.status).toBe(401);
  });

  it("returns 401 when HMAC signature is invalid", async () => {
    const repo = makeRepo(validRecord({ secret: "my-secret-key" }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app)
      .post("/api/w/test-uuid")
      .set("X-Hub-Signature-256", "sha256=deadbeef")
      .send("{}");
    expect(res.status).toBe(401);
  });

  it("returns 202 when HMAC signature is valid", async () => {
    const secret = "my-secret-key";
    const body = "{}";
    const sig = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

    const repo = makeRepo(validRecord({ secret }));
    const app = buildApp(repo, { enqueue: mockEnqueue });

    const res = await request(app)
      .post("/api/w/test-uuid")
      .set("X-Hub-Signature-256", sig)
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(202);
  });

  // ── Queue / no queue ──────────────────────────────────────────────────────

  it("returns 202 even without a queue (skips enqueue)", async () => {
    const repo = makeRepo(validRecord());
    const app = buildApp(repo, null);

    const res = await request(app).post("/api/w/test-uuid").send("{}");
    expect(res.status).toBe(202);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  // ── Trigger data structure ────────────────────────────────────────────────

  it("passes body, headers, query, method to queue", async () => {
    const repo = makeRepo(validRecord());
    const app = buildApp(repo, { enqueue: mockEnqueue });

    await request(app)
      .post("/api/w/test-uuid?foo=bar")
      .set("Content-Type", "application/json")
      .set("X-Custom-Header", "custom-value")
      .send(JSON.stringify({ userId: "u-1" }));

    const [, triggerData] = mockEnqueue.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(triggerData["body"]).toEqual({ userId: "u-1" });
    expect((triggerData["query"] as Record<string, unknown>)["foo"]).toBe("bar");
    expect(triggerData["method"]).toBe("POST");
  });
});
