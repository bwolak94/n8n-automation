import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DatabaseNode } from "../../nodes/implementations/DatabaseNode.js";
import type { ICredentialVault } from "../../nodes/implementations/DatabaseNode.js";
import { AppError } from "../../shared/errors/index.js";
import type { IDbClientFactory, IDbRunner } from "../../nodes/implementations/db/DatabaseClientFactory.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

function makeRunner(
  rows: Record<string, unknown>[] = [],
  rowCount?: number
): IDbRunner & {
  query: jest.Mock;
  commit: jest.Mock;
  rollback: jest.Mock;
  release: jest.Mock;
} {
  return {
    query:    jest.fn<IDbRunner["query"]>().mockResolvedValue({ rows, rowCount: rowCount ?? rows.length }),
    commit:   jest.fn<IDbRunner["commit"]>().mockResolvedValue(undefined),
    rollback: jest.fn<IDbRunner["rollback"]>().mockResolvedValue(undefined),
    release:  jest.fn<IDbRunner["release"]>().mockResolvedValue(undefined),
  };
}

function makeFactory(runner: IDbRunner): IDbClientFactory & { getRunner: jest.Mock } {
  return {
    getRunner: jest.fn<IDbClientFactory["getRunner"]>().mockResolvedValue(runner),
    closeAll:  jest.fn<IDbClientFactory["closeAll"]>().mockResolvedValue(undefined),
  };
}

function makeVault(
  data: Record<string, string> = { dsn: "postgresql://localhost/test" }
): ICredentialVault & { getCredentialData: jest.Mock } {
  return {
    getCredentialData: jest.fn<ICredentialVault["getCredentialData"]>().mockResolvedValue(data),
  };
}

// ─── Definition ───────────────────────────────────────────────────────────────

describe("DatabaseNode — definition", () => {
  const node = new DatabaseNode();

  it("has type 'database'", () => {
    expect(node.definition.type).toBe("database");
  });

  it("configSchema requires credentialId and sql", () => {
    const schema = node.definition.configSchema as Record<string, unknown>;
    const required = schema["required"] as string[];
    expect(required).toContain("credentialId");
    expect(required).toContain("sql");
  });
});

// ─── Validation ───────────────────────────────────────────────────────────────

describe("DatabaseNode — validation", () => {
  it("throws DB_MISSING_CREDENTIAL_ID when credentialId absent", async () => {
    const node = new DatabaseNode(makeVault(), makeFactory(makeRunner()));
    await expect(
      node.execute({}, { sql: "SELECT 1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_CREDENTIAL_ID" });
  });

  it("throws DB_MISSING_SQL when sql absent", async () => {
    const node = new DatabaseNode(makeVault(), makeFactory(makeRunner()));
    await expect(
      node.execute({}, { credentialId: "cred-1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_SQL" });
  });

  it("throws DB_NO_VAULT when no credential vault configured", async () => {
    const node = new DatabaseNode(undefined, makeFactory(makeRunner()));
    await expect(
      node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_NO_VAULT" });
  });
});

// ─── Successful execution ─────────────────────────────────────────────────────

describe("DatabaseNode — successful execution", () => {
  let runner: ReturnType<typeof makeRunner>;
  let factory: ReturnType<typeof makeFactory>;
  let vault: ReturnType<typeof makeVault>;
  let node: DatabaseNode;

  beforeEach(() => {
    runner = makeRunner([{ id: 1, user_name: "Alice" }], 1);
    factory = makeFactory(runner);
    vault = makeVault({ dsn: "postgresql://localhost/test" });
    node = new DatabaseNode(vault, factory);
  });

  it("returns rows, rowCount, durationMs on success", async () => {
    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM users", dialect: "postgres" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(true);
    expect(data["rows"]).toEqual([{ id: 1, user_name: "Alice" }]);
    expect(data["rowCount"]).toBe(1);
    expect(typeof data["durationMs"]).toBe("number");
  });

  it("passes sql and params to runner", async () => {
    await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM users WHERE id = $1", params: [42], dialect: "postgres" },
      ctx
    );
    expect(runner.query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = $1",
      [42]
    );
  });

  it("defaults params to empty array", async () => {
    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    expect(runner.query).toHaveBeenCalledWith("SELECT 1", []);
  });

  it("calls commit after successful query", async () => {
    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    expect(runner.commit).toHaveBeenCalled();
  });

  it("always calls release — even when query succeeds", async () => {
    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    expect(runner.release).toHaveBeenCalled();
  });

  it("passes dialect and dsn to factory.getRunner", async () => {
    vault = makeVault({ dsn: "postgresql://myhost/mydb" });
    node = new DatabaseNode(vault, factory);

    await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT 1", dialect: "postgres" },
      ctx
    );
    expect(factory.getRunner).toHaveBeenCalledWith("postgres", "postgresql://myhost/mydb", false);
  });

  it("passes transaction=true to factory.getRunner when configured", async () => {
    await node.execute(
      {},
      { credentialId: "cred-1", sql: "UPDATE t SET x=1", dialect: "postgres", transaction: true },
      ctx
    );
    expect(factory.getRunner).toHaveBeenCalledWith("postgres", expect.any(String), true);
  });

  it("resolves credential by tenantId", async () => {
    await node.execute({}, { credentialId: "cred-xyz", sql: "SELECT 1" }, ctx);
    expect(vault.getCredentialData).toHaveBeenCalledWith("t-1", "cred-xyz");
  });
});

// ─── Row limit ────────────────────────────────────────────────────────────────

describe("DatabaseNode — row limit", () => {
  it("slices rows to maxRows", async () => {
    const manyRows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const runner = makeRunner(manyRows, 50);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM t", maxRows: 10 },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect((data["rows"] as unknown[]).length).toBe(10);
    expect(data["rowCount"]).toBe(10);
  });

  it("does not slice when rows < maxRows", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const runner = makeRunner(rows, 2);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM t", maxRows: 1000 },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect((data["rows"] as unknown[]).length).toBe(2);
  });
});

// ─── camelCase mapping ────────────────────────────────────────────────────────

describe("DatabaseNode — camelCase mapping", () => {
  it("converts snake_case keys when camelCase is true", async () => {
    const runner = makeRunner([{ user_id: 1, first_name: "Alice", created_at: "2024" }]);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM users", camelCase: true },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect((data["rows"] as Record<string, unknown>[])[0]).toEqual({
      userId: 1,
      firstName: "Alice",
      createdAt: "2024",
    });
  });

  it("does not modify keys when camelCase is false", async () => {
    const runner = makeRunner([{ user_id: 1 }]);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM t", camelCase: false },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect((data["rows"] as Record<string, unknown>[])[0]).toHaveProperty("user_id");
  });
});

// ─── DSN building from individual fields ─────────────────────────────────────

describe("DatabaseNode — DSN construction", () => {
  it("builds postgres DSN from host/database/user/password fields", async () => {
    const vault = makeVault({ host: "myhost", database: "mydb", user: "u", password: "p@ss" });
    const runner = makeRunner([]);
    const factory = makeFactory(runner);
    const node = new DatabaseNode(vault, factory);

    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1", dialect: "postgres" }, ctx);

    const calledDsn = (factory.getRunner.mock.calls[0] as unknown[])[1] as string;
    expect(calledDsn).toMatch(/^postgresql:\/\//);
    expect(calledDsn).toContain("myhost");
    expect(calledDsn).toContain("mydb");
  });

  it("throws DB_MISSING_DSN when no dsn and no database field", async () => {
    const vault = makeVault({ host: "myhost" });
    const node = new DatabaseNode(vault, makeFactory(makeRunner()));

    await expect(
      node.execute({}, { credentialId: "cred-1", sql: "SELECT 1", dialect: "postgres" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_DSN" });
  });

  it("builds mysql DSN from individual fields using port 3306", async () => {
    const vault = makeVault({ host: "mysqlhost", database: "mydb", user: "u", password: "p" });
    const runner = makeRunner([]);
    const factory = makeFactory(runner);
    const node = new DatabaseNode(vault, factory);

    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1", dialect: "mysql" }, ctx);

    const calledDsn = (factory.getRunner.mock.calls[0] as unknown[])[1] as string;
    expect(calledDsn).toMatch(/^mysql:\/\//);
    expect(calledDsn).toContain("3306");
  });

  it("throws DB_MISSING_PATH for sqlite credential without path field", async () => {
    const vault = makeVault({ host: "irrelevant" });
    const node = new DatabaseNode(vault, makeFactory(makeRunner()));

    await expect(
      node.execute({}, { credentialId: "cred-1", sql: "SELECT 1", dialect: "sqlite" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_PATH" });
  });

  it("passes sqlite file path from credential path field to factory", async () => {
    const vault = makeVault({ path: "/data/sqlite/app.db" });
    const runner = makeRunner([]);
    const factory = makeFactory(runner);
    const node = new DatabaseNode(vault, factory);

    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1", dialect: "sqlite" }, ctx);

    const calledDsn = (factory.getRunner.mock.calls[0] as unknown[])[1] as string;
    expect(calledDsn).toBe("/data/sqlite/app.db");
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("DatabaseNode — error handling", () => {
  it("returns success:false with friendly message on pg 23505 (duplicate key)", async () => {
    const err = Object.assign(new Error("duplicate key"), { code: "23505" });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "INSERT INTO t VALUES ($1)", params: [1], dialect: "postgres" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["error"] as string).toContain("Duplicate key");
  });

  it("returns success:false with friendly message on pg 42P01 (table not found)", async () => {
    const err = Object.assign(new Error("no such table"), { code: "42P01" });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM ghost", dialect: "postgres" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["error"] as string).toContain("not found");
  });

  it("always calls release even when query throws", async () => {
    const runner = makeRunner();
    runner.query.mockRejectedValue(new Error("boom"));
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    expect(runner.release).toHaveBeenCalled();
  });

  it("calls rollback on query error when transaction mode is on", async () => {
    const runner = makeRunner();
    runner.query.mockRejectedValue(new Error("tx error"));
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    await node.execute(
      {},
      { credentialId: "cred-1", sql: "INSERT INTO t VALUES (1)", transaction: true },
      ctx
    );
    expect(runner.rollback).toHaveBeenCalled();
  });

  it("rethrows AppError thrown by runner.query and calls rollback", async () => {
    const runner = makeRunner();
    const appErr = new AppError("plan limit exceeded", 402, "PLAN_LIMIT");
    runner.query.mockRejectedValue(appErr);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    await expect(
      node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx)
    ).rejects.toMatchObject({ code: "PLAN_LIMIT" });

    expect(runner.rollback).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it("returns success:false with string representation when non-Error is thrown", async () => {
    const runner = makeRunner();
    runner.query.mockRejectedValue("raw string error");
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["error"]).toBe("raw string error");
  });

  it("returns friendly message on pg 42703 (column not found)", async () => {
    const err = Object.assign(new Error("column unknown"), { code: "42703" });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT bad_col FROM t", dialect: "postgres" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["error"] as string).toContain("Column");
  });

  it("returns friendly message on pg ECONNREFUSED", async () => {
    const err = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT 1", dialect: "postgres" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["error"] as string).toContain("connect");
  });

  it("returns success:false with friendly message on mysql 1146 (table not found)", async () => {
    const err = Object.assign(new Error("no such table"), { errno: 1146 });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT * FROM ghost", dialect: "mysql" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["error"] as string).toContain("not found");
  });

  it("does not include connection string in error output", async () => {
    const secretDsn = "postgresql://user:super-secret@host/db";
    const vault = makeVault({ dsn: secretDsn });
    const runner = makeRunner();
    runner.query.mockRejectedValue(new Error("generic error"));
    const node = new DatabaseNode(vault, makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "SELECT 1" },
      ctx
    );
    expect(JSON.stringify(output.data)).not.toContain("super-secret");
  });

  it("returns success:false with friendly message on mysql 1062 (duplicate key)", async () => {
    const err = Object.assign(new Error("dup entry"), { errno: 1062 });
    const runner = makeRunner();
    runner.query.mockRejectedValue(err);
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute(
      {},
      { credentialId: "cred-1", sql: "INSERT INTO t VALUES (?)", dialect: "mysql" },
      ctx
    );
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["error"] as string).toContain("Duplicate key");
  });

  it("returns success:false and empty rows on runtime error", async () => {
    const runner = makeRunner();
    runner.query.mockRejectedValue(new Error("network error"));
    const node = new DatabaseNode(makeVault(), makeFactory(runner));

    const output = await node.execute({}, { credentialId: "cred-1", sql: "SELECT 1" }, ctx);
    const data = output.data as Record<string, unknown>;
    expect(data["success"]).toBe(false);
    expect(data["rows"]).toEqual([]);
    expect(data["rowCount"]).toBe(0);
  });
});
