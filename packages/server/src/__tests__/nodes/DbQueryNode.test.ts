import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DbQueryNode } from "../../nodes/implementations/DbQueryNode.js";
import type { ICredentialStore, QueryRunner, PoolFactory, DatabaseCredential } from "../../nodes/contracts/ICredentialStore.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "tenant-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

const fakeCred: DatabaseCredential = {
  host: "db.example.com",
  port: 5432,
  database: "mydb",
  user: "admin",
  password: "secret",
};

function makeCredentialStore(
  cred: DatabaseCredential | null = fakeCred
): ICredentialStore & { get: jest.Mock } {
  return {
    get: jest
      .fn<ICredentialStore["get"]>()
      .mockResolvedValue(cred),
  };
}

function makeRunner(
  rows: Record<string, unknown>[] = [],
  rowCount = 0
): QueryRunner & { query: jest.Mock; end: jest.Mock } {
  return {
    query: jest
      .fn<QueryRunner["query"]>()
      .mockResolvedValue({ rows, rowCount }),
    end: jest.fn<QueryRunner["end"]>().mockResolvedValue(undefined),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DbQueryNode", () => {
  let credStore: ReturnType<typeof makeCredentialStore>;
  let runner: ReturnType<typeof makeRunner>;
  let poolFactory: jest.MockedFunction<PoolFactory>;
  let node: DbQueryNode;

  beforeEach(() => {
    credStore = makeCredentialStore();
    runner = makeRunner([{ id: 1, name: "Alice" }], 1);
    poolFactory = jest.fn<PoolFactory>().mockReturnValue(runner);
    node = new DbQueryNode(credStore, poolFactory);
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("db_query");
  });

  it("looks up credentials by connectionId and tenantId", async () => {
    await node.execute(
      {},
      { connectionId: "conn-1", query: "SELECT 1" },
      ctx
    );

    expect(credStore.get).toHaveBeenCalledWith("conn-1", "tenant-1");
  });

  it("returns rows, rowCount and durationMs on success", async () => {
    const output = await node.execute(
      {},
      { connectionId: "conn-1", query: "SELECT * FROM users" },
      ctx
    );

    const data = output.data as Record<string, unknown>;
    expect(data["rows"]).toEqual([{ id: 1, name: "Alice" }]);
    expect(data["rowCount"]).toBe(1);
    expect(typeof data["durationMs"]).toBe("number");
  });

  it("passes parameterised query and params separately — injection prevention", async () => {
    await node.execute(
      {},
      {
        connectionId: "conn-1",
        query: "SELECT * FROM users WHERE id = $1",
        params: ["user-42"],
      },
      ctx
    );

    // Params must NEVER be interpolated into the SQL string — they go as a
    // separate argument to pool.query(), where pg handles escaping
    expect(runner.query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE id = $1",
      ["user-42"]
    );
  });

  it("defaults params to empty array when not specified", async () => {
    await node.execute(
      {},
      { connectionId: "conn-1", query: "SELECT NOW()" },
      ctx
    );

    expect(runner.query).toHaveBeenCalledWith("SELECT NOW()", []);
  });

  it("always calls runner.end() — even when query throws", async () => {
    runner.query.mockRejectedValue(new Error("Query error"));

    await expect(
      node.execute({}, { connectionId: "conn-1", query: "BAD SQL" }, ctx)
    ).rejects.toThrow("Query error");

    expect(runner.end).toHaveBeenCalledTimes(1);
  });

  it("throws DB_CONNECTION_NOT_FOUND when credential lookup returns null", async () => {
    credStore = makeCredentialStore(null);
    node = new DbQueryNode(credStore, poolFactory);

    await expect(
      node.execute({}, { connectionId: "missing", query: "SELECT 1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_CONNECTION_NOT_FOUND", statusCode: 404 });
  });

  it("throws DB_MISSING_CONNECTION_ID when connectionId is absent", async () => {
    await expect(
      node.execute({}, { query: "SELECT 1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_CONNECTION_ID" });
  });

  it("throws DB_MISSING_QUERY when query is absent", async () => {
    await expect(
      node.execute({}, { connectionId: "conn-1" }, ctx)
    ).rejects.toMatchObject({ code: "DB_MISSING_QUERY" });
  });

  it("passes the resolved credential to the pool factory", async () => {
    await node.execute(
      {},
      { connectionId: "conn-1", query: "SELECT 1" },
      ctx
    );

    expect(poolFactory).toHaveBeenCalledWith(fakeCred);
  });
});
