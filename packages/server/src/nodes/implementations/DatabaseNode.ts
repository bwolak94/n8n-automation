import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { IDbClientFactory } from "./db/DatabaseClientFactory.js";
import { DatabaseClientFactory } from "./db/DatabaseClientFactory.js";

// ─── Credential vault interface ────────────────────────────────────────────────

/** Minimal subset of CredentialService needed by DatabaseNode. */
export interface ICredentialVault {
  getCredentialData(tenantId: string, credentialId: string): Promise<Record<string, string>>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildDsn(dialect: string, cred: Record<string, string>): string {
  if (cred["dsn"]) return cred["dsn"];

  if (dialect === "sqlite") {
    const filePath = cred["path"];
    if (!filePath)
      throw new AppError("SQLite credential requires a 'path' field", 400, "DB_MISSING_PATH");
    return filePath;
  }

  const { host = "localhost", port, database, user = "", password = "" } = cred;
  const portNum = port ?? (dialect === "postgres" ? "5432" : "3306");
  if (!database)
    throw new AppError(
      "Database credential requires a 'dsn' or 'database' field",
      400,
      "DB_MISSING_DSN"
    );
  const proto = dialect === "postgres" ? "postgresql" : "mysql";
  const encodedPass = encodeURIComponent(password);
  return `${proto}://${user}:${encodedPass}@${host}:${portNum}/${database}`;
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function convertRowKeys(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamelCase(k), v]))
  );
}

function mapDbError(dialect: string, err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as { code?: string }).code ?? "";
  const errno = (err as { errno?: number }).errno;

  if (dialect === "postgres") {
    if (code === "23505") return "Duplicate key value violates unique constraint";
    if (code === "42P01") return "Table or view not found";
    if (code === "42703") return "Column not found";
    if (code === "23503") return "Foreign key constraint violation";
    if (/ECONNREFUSED|ENOTFOUND/.test(code)) return "Could not connect to database server";
  }
  if (dialect === "mysql") {
    if (errno === 1062 || code === "ER_DUP_ENTRY") return "Duplicate key value";
    if (errno === 1146 || code === "ER_NO_SUCH_TABLE") return "Table not found";
  }
  return err.message;
}

// Module-level singleton — used when no factory is injected
let _defaultFactory: DatabaseClientFactory | undefined;
/* istanbul ignore next */
const getDefaultFactory = (): DatabaseClientFactory => {
  /* istanbul ignore next */
  _defaultFactory ??= new DatabaseClientFactory();
  return _defaultFactory;
};

// ─── DatabaseNode ──────────────────────────────────────────────────────────────

export class DatabaseNode implements INode {
  readonly definition: NodeDefinition = {
    type: "database",
    name: "Database Query",
    description:
      "Execute parameterised SQL queries against PostgreSQL, MySQL, or SQLite databases",
    configSchema: {
      type: "object",
      required: ["credentialId", "sql"],
      properties: {
        dialect:      { type: "string", enum: ["postgres", "mysql", "sqlite"], default: "postgres" },
        credentialId: { type: "string", description: "Credential vault ID for the database connection" },
        operation:    { type: "string", enum: ["query", "insert", "update", "delete", "execute"], default: "query" },
        sql:          { type: "string", description: "Parameterised SQL (use $1/$2 for pg, ? for mysql/sqlite)" },
        params:       { type: "array", items: {}, description: "Query parameter values" },
        maxRows:      { type: "number", default: 1000 },
        transaction:  { type: "boolean", default: false },
        camelCase:    { type: "boolean", default: false },
      },
    },
  };

  constructor(
    private readonly credentialVault?: ICredentialVault,
    private readonly clientFactory?: IDbClientFactory
  ) {}

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    // ── Validation ─────────────────────────────────────────────────────────────

    const credentialId = config["credentialId"] as string | undefined;
    const sql = config["sql"] as string | undefined;

    if (!credentialId)
      throw new AppError("DatabaseNode requires a 'credentialId'", 400, "DB_MISSING_CREDENTIAL_ID");
    if (!sql)
      throw new AppError("DatabaseNode requires a 'sql' statement", 400, "DB_MISSING_SQL");

    if (!this.credentialVault)
      throw new AppError("DatabaseNode: no credential vault configured", 500, "DB_NO_VAULT");

    const dialect   = (config["dialect"] as string | undefined) ?? "postgres";
    const params    = (config["params"] as unknown[] | undefined) ?? [];
    const maxRows   = (config["maxRows"] as number | undefined) ?? 1000;
    const useTransaction = config["transaction"] === true;
    const useCamelCase   = config["camelCase"] === true;

    // ── Resolve credential → DSN ───────────────────────────────────────────────

    const credData = await this.credentialVault.getCredentialData(context.tenantId, credentialId);
    const dsn = buildDsn(dialect, credData);

    // ── Execute query ──────────────────────────────────────────────────────────

    const factory = this.clientFactory ?? getDefaultFactory();
    const runner = await factory.getRunner(dialect, dsn, useTransaction);
    const startedAt = Date.now();

    try {
      const result = await runner.query(sql, params);
      await runner.commit();

      const rawRows = result.rows.slice(0, maxRows);
      const rows = useCamelCase ? convertRowKeys(rawRows) : rawRows;

      return {
        data: {
          success: true,
          rows,
          rowCount: rows.length,
          durationMs: Date.now() - startedAt,
        },
      };
    } catch (err) {
      if (err instanceof AppError) {
        await runner.rollback().catch(/* istanbul ignore next */ () => {});
        await runner.release().catch(/* istanbul ignore next */ () => {});
        throw err;
      }

      await runner.rollback().catch(/* istanbul ignore next */ () => {});
      const friendly = mapDbError(dialect, err);
      return {
        data: {
          success: false,
          rows: [],
          rowCount: 0,
          error: friendly,
          durationMs: Date.now() - startedAt,
        },
      };
    } finally {
      await runner.release().catch(/* istanbul ignore next */ () => {});
    }
  }
}
