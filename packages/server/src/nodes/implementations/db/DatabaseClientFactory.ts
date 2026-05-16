import path from "node:path";
import { createRequire } from "node:module";
import { Pool as PgPool } from "pg";
import { AppError } from "../../../shared/errors/index.js";

const requireCjs = createRequire(import.meta.url);

// ─── Public interfaces ─────────────────────────────────────────────────────────

export interface DbResult {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface IDbRunner {
  query(sql: string, params?: unknown[]): Promise<DbResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

export interface IDbClientFactory {
  getRunner(dialect: string, dsn: string, transaction?: boolean): Promise<IDbRunner>;
  closeAll(): Promise<void>;
}

// Injectable factory type for pg pool (enables unit testing without a live DB)
export type PgPoolFactory = (connectionString: string) => PgPool;

// ─── PostgreSQL runners ────────────────────────────────────────────────────────

type PgPoolClient = Awaited<ReturnType<PgPool["connect"]>>;

class PgPoolRunner implements IDbRunner {
  constructor(private readonly pool: PgPool) {}

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const result = await this.pool.query(sql, params as unknown[]);
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? result.rows.length };
  }
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async release(): Promise<void> {}
}

class PgTransactionRunner implements IDbRunner {
  constructor(private readonly client: PgPoolClient) {}

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const result = await this.client.query(sql, params as unknown[]);
    return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? result.rows.length };
  }
  async commit(): Promise<void> { await this.client.query("COMMIT"); }
  async rollback(): Promise<void> { await this.client.query("ROLLBACK").catch(() => {}); }
  async release(): Promise<void> { this.client.release(); }
}

// ─── MySQL runners ─────────────────────────────────────────────────────────────

interface MySqlConnection {
  query(sql: string, params?: unknown[]): Promise<[unknown[], unknown[]]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}

interface MySqlPool {
  query(sql: string, params?: unknown[]): Promise<[unknown[], unknown[]]>;
  getConnection(): Promise<MySqlConnection>;
  end(): Promise<void>;
}

class MySqlPoolRunner implements IDbRunner {
  constructor(private readonly pool: MySqlPool) {}

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const [rows] = await this.pool.query(sql, params);
    const arr = rows as Record<string, unknown>[];
    return { rows: arr, rowCount: arr.length };
  }
  async commit(): Promise<void> {}
  async rollback(): Promise<void> {}
  async release(): Promise<void> {}
}

class MySqlTransactionRunner implements IDbRunner {
  constructor(private readonly conn: MySqlConnection) {}

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const [rows] = await this.conn.query(sql, params);
    const arr = rows as Record<string, unknown>[];
    return { rows: arr, rowCount: arr.length };
  }
  async commit(): Promise<void> { await this.conn.commit(); }
  async rollback(): Promise<void> { await this.conn.rollback().catch(() => {}); }
  async release(): Promise<void> { this.conn.release(); }
}

// ─── SQLite runner ─────────────────────────────────────────────────────────────

interface SqliteDb {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): { changes: number };
  };
  exec(sql: string): void;
}

class SqliteRunner implements IDbRunner {
  constructor(private readonly db: SqliteDb, private readonly inTransaction: boolean) {
    if (inTransaction) db.exec("BEGIN");
  }

  async query(sql: string, params?: unknown[]): Promise<DbResult> {
    const stmt = this.db.prepare(sql);
    if (/^\s*SELECT/i.test(sql)) {
      const rows = stmt.all(...(params ?? [])) as Record<string, unknown>[];
      return { rows, rowCount: rows.length };
    }
    const info = stmt.run(...(params ?? []));
    return { rows: [], rowCount: info.changes };
  }

  async commit(): Promise<void> {
    if (this.inTransaction) this.db.exec("COMMIT");
  }

  async rollback(): Promise<void> {
    if (this.inTransaction) {
      try { this.db.exec("ROLLBACK"); } catch { /* ignore */ }
    }
  }

  async release(): Promise<void> {}
}

// ─── DatabaseClientFactory ─────────────────────────────────────────────────────

export class DatabaseClientFactory implements IDbClientFactory {
  private readonly pools = new Map<string, unknown>();

  constructor(
    private readonly pgPoolFactory: PgPoolFactory = (dsn) =>
      new PgPool({ connectionString: dsn, max: 5 }),
    readonly sqliteBaseDir: string = path.join(process.cwd(), "data", "sqlite")
  ) {}

  async getRunner(dialect: string, dsn: string, transaction = false): Promise<IDbRunner> {
    switch (dialect) {
      case "postgres": return this.getPgRunner(dsn, transaction);
      case "mysql":    return this.getMysqlRunner(dsn, transaction);
      case "sqlite":   return this.getSqliteRunner(dsn, transaction);
      default:
        throw new AppError(`Unknown database dialect '${dialect}'`, 400, "DB_UNKNOWN_DIALECT");
    }
  }

  async closeAll(): Promise<void> {
    for (const [, pool] of this.pools) {
      const p = pool as { end?: () => Promise<void> };
      /* istanbul ignore next */
      if (p.end) await p.end().catch(() => {});
    }
    this.pools.clear();
  }

  private async getPgRunner(dsn: string, transaction: boolean): Promise<IDbRunner> {
    const cacheKey = `postgres:${dsn}`;
    let pool = this.pools.get(cacheKey) as PgPool | undefined;
    if (!pool) {
      pool = this.pgPoolFactory(dsn);
      this.pools.set(cacheKey, pool);
    }
    if (transaction) {
      const client = await pool.connect();
      await client.query("BEGIN");
      return new PgTransactionRunner(client);
    }
    return new PgPoolRunner(pool);
  }

  private async getMysqlRunner(dsn: string, transaction: boolean): Promise<IDbRunner> {
    /* istanbul ignore next */
    let mysql: { createPool(dsn: string): MySqlPool } | undefined;
    /* istanbul ignore next */
    try {
      mysql = (await import("mysql2/promise")) as typeof mysql;
    } catch {
      throw new AppError(
        "mysql2 driver not installed — run: pnpm add mysql2",
        500,
        "DB_DRIVER_MISSING"
      );
    }

    const cacheKey = `mysql:${dsn}`;
    let pool = this.pools.get(cacheKey) as MySqlPool | undefined;
    /* istanbul ignore next */
    if (!pool) {
      pool = mysql!.createPool(dsn);
      this.pools.set(cacheKey, pool);
    }
    /* istanbul ignore next */
    if (transaction) {
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      return new MySqlTransactionRunner(conn);
    }
    /* istanbul ignore next */
    return new MySqlPoolRunner(pool);
  }

  private getSqliteRunner(filePath: string, transaction: boolean): IDbRunner {
    const resolved = path.resolve(filePath);
    const base = path.resolve(this.sqliteBaseDir);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new AppError(
        `SQLite path is outside the allowed directory '${this.sqliteBaseDir}'`,
        400,
        "DB_SQLITE_PATH_TRAVERSAL"
      );
    }

    const cacheKey = `sqlite:${resolved}`;
    let db = this.pools.get(cacheKey) as SqliteDb | undefined;
    if (!db) {
      /* istanbul ignore next */
      let BetterSqlite3: new (path: string) => SqliteDb;
      /* istanbul ignore next */
      try {
        BetterSqlite3 = requireCjs("better-sqlite3") as new (path: string) => SqliteDb;
      } catch {
        throw new AppError(
          "better-sqlite3 driver not installed — run: pnpm add better-sqlite3",
          500,
          "DB_DRIVER_MISSING"
        );
      }
      /* istanbul ignore next */
      db = new BetterSqlite3(resolved);
      /* istanbul ignore next */
      this.pools.set(cacheKey, db);
    }
    return new SqliteRunner(db, transaction);
  }
}
