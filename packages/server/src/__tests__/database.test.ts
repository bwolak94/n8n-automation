import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── ESM mocks (must precede dynamic import of database.ts) ───────────────────

const mockMongooseConnect = jest.fn<() => Promise<void>>();

jest.unstable_mockModule("mongoose", () => ({
  default: { connect: mockMongooseConnect },
}));

const mockPgClientRelease = jest.fn();
const mockPgClientQuery = jest.fn<() => Promise<{ rows: unknown[] }>>().mockResolvedValue({ rows: [] });
const mockPgConnect = jest
  .fn<() => Promise<{ query: jest.Mock; release: jest.Mock }>>()
  .mockResolvedValue({ query: mockPgClientQuery, release: mockPgClientRelease });

jest.unstable_mockModule("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({ connect: mockPgConnect })),
}));

const {
  connectWithRetry,
  connectMongoDB,
  connectPostgres,
  connectDatabases,
} = await import("../config/database.js");

// ─────────────────────────────────────────────────────────────────────────────

const NO_DELAY = 0;

describe("connectWithRetry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves immediately when connectFn succeeds on the first attempt", async () => {
    const connectFn = jest.fn<() => Promise<void>>().mockResolvedValue();

    await expect(
      connectWithRetry(connectFn, "TestDB", 3, NO_DELAY)
    ).resolves.toBeUndefined();

    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on the third attempt", async () => {
    const connectFn = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue();

    await expect(
      connectWithRetry(connectFn, "TestDB", 3, NO_DELAY)
    ).resolves.toBeUndefined();

    expect(connectFn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting all retry attempts", async () => {
    const error = new Error("Permanent failure");
    const connectFn = jest.fn<() => Promise<void>>().mockRejectedValue(error);

    await expect(
      connectWithRetry(connectFn, "TestDB", 3, NO_DELAY)
    ).rejects.toThrow("Permanent failure");

    expect(connectFn).toHaveBeenCalledTimes(3);
  });

  it("does not retry when the first attempt passes", async () => {
    const connectFn = jest.fn<() => Promise<void>>().mockResolvedValue();

    await connectWithRetry(connectFn, "TestDB", 5, NO_DELAY);

    expect(connectFn).toHaveBeenCalledTimes(1);
  });

  it("propagates the last error when all attempts fail", async () => {
    const firstError = new Error("First fail");
    const lastError = new Error("Final attempt failed");
    const connectFn = jest
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(lastError);

    await expect(
      connectWithRetry(connectFn, "TestDB", 2, NO_DELAY)
    ).rejects.toBe(lastError);
  });
});

describe("connectMongoDB", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls mongoose.connect with MONGODB_URI and resolves", async () => {
    mockMongooseConnect.mockResolvedValue();

    await expect(connectMongoDB(1, NO_DELAY)).resolves.toBeUndefined();

    expect(mockMongooseConnect).toHaveBeenCalledWith(
      process.env["MONGODB_URI"]
    );
  });

  it("retries on mongoose.connect failure", async () => {
    mockMongooseConnect
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue();

    await expect(connectMongoDB(2, NO_DELAY)).resolves.toBeUndefined();
    expect(mockMongooseConnect).toHaveBeenCalledTimes(2);
  });

  it("throws when all retries fail", async () => {
    mockMongooseConnect.mockRejectedValue(new Error("Mongo down"));

    await expect(connectMongoDB(2, NO_DELAY)).rejects.toThrow("Mongo down");
  });
});

describe("connectPostgres", () => {
  beforeEach(() => jest.clearAllMocks());

  it("probes the pool and resolves on success", async () => {
    await expect(connectPostgres(1, NO_DELAY)).resolves.toBeUndefined();

    expect(mockPgConnect).toHaveBeenCalledTimes(1);
    expect(mockPgClientRelease).toHaveBeenCalledTimes(1);
  });

  it("retries on pool connect failure", async () => {
    mockPgConnect
      .mockRejectedValueOnce(new Error("PG ECONNREFUSED"))
      .mockResolvedValue({ query: mockPgClientQuery, release: mockPgClientRelease });

    await expect(connectPostgres(2, NO_DELAY)).resolves.toBeUndefined();
    expect(mockPgConnect).toHaveBeenCalledTimes(2);
  });

  it("throws when all retries fail", async () => {
    mockPgConnect.mockRejectedValue(new Error("PG down"));

    await expect(connectPostgres(2, NO_DELAY)).rejects.toThrow("PG down");
  });
});

describe("connectDatabases", () => {
  beforeEach(() => jest.clearAllMocks());

  it("connects both MongoDB and PostgreSQL in parallel", async () => {
    mockMongooseConnect.mockResolvedValue();
    mockPgConnect.mockResolvedValue({
      query: mockPgClientQuery,
      release: mockPgClientRelease,
    });

    await expect(connectDatabases()).resolves.toBeUndefined();

    expect(mockMongooseConnect).toHaveBeenCalledTimes(1);
    expect(mockPgConnect).toHaveBeenCalledTimes(1);
  });
});
