import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

// ── ESM mocks (must precede dynamic import of app.ts) ────────────────────────

const mockPgConnect = jest
  .fn<() => Promise<{ query: jest.Mock; release: jest.Mock }>>()
  .mockResolvedValue({
    query: jest.fn<() => Promise<{ rows: unknown[] }>>().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  });

jest.unstable_mockModule("../config/database.js", () => ({
  pgPool: { connect: mockPgConnect },
  connectDatabases: jest.fn(),
  connectMongoDB: jest.fn(),
  connectPostgres: jest.fn(),
  connectWithRetry: jest.fn(),
}));

// Mutable so individual tests can override readyState
const mongooseMock = {
  default: {
    connect: jest.fn(),
    connection: { readyState: 1 },
    model: jest.fn().mockReturnValue({}),
    models: {},
    Schema: jest.fn().mockImplementation(() => ({ index: jest.fn() })),
  },
};

jest.unstable_mockModule("mongoose", () => mongooseMock);

jest.unstable_mockModule("../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: jest.fn() },
}));

const { createApp } = await import("../app.js");

// ─────────────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    // reset pg mock to succeed by default
    mockPgConnect.mockResolvedValue({
      query: jest.fn<() => Promise<{ rows: unknown[] }>>().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });
    // reset mongo readyState to connected
    mongooseMock.default.connection.readyState = 1;
  });

  it("returns HTTP 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("responds with status:'ok' and databases object", async () => {
    const res = await request(app).get("/health");
    expect(res.body).toMatchObject({
      status: "ok",
      databases: {
        mongo: expect.any(String),
        postgres: expect.any(String),
      },
    });
  });

  it("reports mongo:'ok' when mongoose readyState is 1", async () => {
    mongooseMock.default.connection.readyState = 1;
    const res = await request(app).get("/health");
    expect(res.body.databases.mongo).toBe("ok");
  });

  it("reports mongo:'degraded' when mongoose readyState is not 1", async () => {
    mongooseMock.default.connection.readyState = 0;
    const res = await request(app).get("/health");
    expect(res.body.databases.mongo).toBe("degraded");
  });

  it("reports postgres:'ok' when pg pool probe succeeds", async () => {
    const res = await request(app).get("/health");
    expect(res.body.databases.postgres).toBe("ok");
  });

  it("reports postgres:'degraded' when pg pool probe throws", async () => {
    mockPgConnect.mockRejectedValueOnce(new Error("Connection refused"));
    const res = await request(app).get("/health");
    expect(res.body.databases.postgres).toBe("degraded");
  });
});
