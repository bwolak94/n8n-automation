import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import path from "node:path";
import type { PgPoolFactory } from "../../nodes/implementations/db/DatabaseClientFactory.js";
import {
  DatabaseClientFactory,
} from "../../nodes/implementations/db/DatabaseClientFactory.js";

// ─── Mock pg.Pool ─────────────────────────────────────────────────────────────

function makePgPool() {
  const fakeClient = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  return {
    query: jest.fn().mockResolvedValue({ rows: [{ now: "2024-01-01" }], rowCount: 1 }),
    connect: jest.fn().mockResolvedValue(fakeClient),
    end: jest.fn().mockResolvedValue(undefined),
    _fakeClient: fakeClient,
  };
}

const TEST_SQLITE_BASE = path.join(process.cwd(), "data", "sqlite");

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("DatabaseClientFactory — PostgreSQL", () => {
  let pgPool: ReturnType<typeof makePgPool>;
  let pgPoolFactory: jest.MockedFunction<PgPoolFactory>;
  let factory: DatabaseClientFactory;

  beforeEach(() => {
    pgPool = makePgPool();
    pgPoolFactory = jest.fn().mockReturnValue(pgPool);
    factory = new DatabaseClientFactory(pgPoolFactory, TEST_SQLITE_BASE);
  });

  it("creates a pg pool on first call and caches it", async () => {
    await factory.getRunner("postgres", "postgresql://localhost/test");
    await factory.getRunner("postgres", "postgresql://localhost/test");

    expect(pgPoolFactory).toHaveBeenCalledTimes(1);
  });

  it("creates separate pools for different DSNs", async () => {
    await factory.getRunner("postgres", "postgresql://localhost/db1");
    await factory.getRunner("postgres", "postgresql://localhost/db2");

    expect(pgPoolFactory).toHaveBeenCalledTimes(2);
  });

  it("non-transaction runner calls pool.query directly", async () => {
    const runner = await factory.getRunner("postgres", "postgresql://localhost/test");
    const result = await runner.query("SELECT NOW()", []);

    expect(pgPool.query).toHaveBeenCalledWith("SELECT NOW()", []);
    expect(result.rows).toHaveLength(1);
  });

  it("transaction runner acquires a client and sends BEGIN", async () => {
    const runner = await factory.getRunner("postgres", "postgresql://localhost/test", true);

    expect(pgPool.connect).toHaveBeenCalled();
    expect(pgPool._fakeClient.query).toHaveBeenCalledWith("BEGIN");
    // subsequent query goes to the client
    await runner.query("SELECT 1", []);
    expect(pgPool._fakeClient.query).toHaveBeenCalledWith("SELECT 1", []);
  });

  it("transaction runner commit sends COMMIT", async () => {
    const runner = await factory.getRunner("postgres", "postgresql://localhost/test", true);
    await runner.commit();
    expect(pgPool._fakeClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("transaction runner rollback sends ROLLBACK", async () => {
    const runner = await factory.getRunner("postgres", "postgresql://localhost/test", true);
    await runner.rollback();
    expect(pgPool._fakeClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("transaction runner release calls client.release()", async () => {
    const runner = await factory.getRunner("postgres", "postgresql://localhost/test", true);
    await runner.release();
    expect(pgPool._fakeClient.release).toHaveBeenCalled();
  });

  it("closeAll ends all pools and clears cache", async () => {
    await factory.getRunner("postgres", "postgresql://localhost/test");
    await factory.closeAll();

    expect(pgPool.end).toHaveBeenCalled();
    // Pool cache is empty — next call creates a new pool
    await factory.getRunner("postgres", "postgresql://localhost/test");
    expect(pgPoolFactory).toHaveBeenCalledTimes(2);
  });
});

describe("DatabaseClientFactory — unknown dialect", () => {
  it("throws DB_UNKNOWN_DIALECT for unsupported dialect", async () => {
    const factory = new DatabaseClientFactory(jest.fn(), TEST_SQLITE_BASE);
    await expect(factory.getRunner("oracle", "dsn")).rejects.toMatchObject({
      code: "DB_UNKNOWN_DIALECT",
    });
  });
});

describe("DatabaseClientFactory — SQLite path traversal", () => {
  it("throws DB_SQLITE_PATH_TRAVERSAL when path escapes base dir", async () => {
    const factory = new DatabaseClientFactory(jest.fn(), TEST_SQLITE_BASE);
    const escapedPath = path.join(TEST_SQLITE_BASE, "..", "..", "etc", "passwd");

    await expect(factory.getRunner("sqlite", escapedPath)).rejects.toMatchObject({
      code: "DB_SQLITE_PATH_TRAVERSAL",
    });
  });

  it("throws DB_SQLITE_PATH_TRAVERSAL for absolute path outside base dir", async () => {
    const factory = new DatabaseClientFactory(jest.fn(), TEST_SQLITE_BASE);

    await expect(factory.getRunner("sqlite", "/etc/secret.db")).rejects.toMatchObject({
      code: "DB_SQLITE_PATH_TRAVERSAL",
    });
  });
});
