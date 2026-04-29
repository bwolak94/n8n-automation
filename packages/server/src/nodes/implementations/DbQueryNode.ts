import { AppError } from "../../shared/errors/index.js";
import type {
  ICredentialStore,
  PoolFactory,
} from "../contracts/ICredentialStore.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import { Pool } from "pg";
import type { DatabaseCredential } from "../contracts/ICredentialStore.js";

function defaultPoolFactory(credential: DatabaseCredential) {
  return new Pool({
    host: credential.host,
    port: credential.port,
    database: credential.database,
    user: credential.user,
    password: credential.password,
    max: 5,
  });
}

export class DbQueryNode implements INode {
  readonly definition: NodeDefinition = {
    type: "db_query",
    name: "Database Query",
    description:
      "Execute a parameterised SQL query against a stored tenant database connection",
    configSchema: {
      type: "object",
      required: ["connectionId", "query"],
      properties: {
        connectionId: {
          type: "string",
          description: "ID of the stored database credential (never raw credentials)",
        },
        query: {
          type: "string",
          description: "Parameterised SQL query using $1, $2, … placeholders",
        },
        params: {
          type: "array",
          description: "Positional query parameters",
          items: {},
        },
      },
    },
  };

  constructor(
    private readonly credentialStore: ICredentialStore,
    private readonly poolFactory: PoolFactory = defaultPoolFactory
  ) {}

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const connectionId = config["connectionId"] as string | undefined;
    const query = config["query"] as string | undefined;
    const params = (config["params"] as unknown[] | undefined) ?? [];

    if (!connectionId) {
      throw new AppError(
        "DbQueryNode requires a connectionId",
        400,
        "DB_MISSING_CONNECTION_ID"
      );
    }
    if (!query) {
      throw new AppError(
        "DbQueryNode requires a query",
        400,
        "DB_MISSING_QUERY"
      );
    }

    const credential = await this.credentialStore.get(
      connectionId,
      context.tenantId
    );

    if (!credential) {
      throw new AppError(
        `Database connection '${connectionId}' not found for tenant '${context.tenantId}'`,
        404,
        "DB_CONNECTION_NOT_FOUND"
      );
    }

    const runner = this.poolFactory(credential);
    const startedAt = Date.now();

    try {
      const result = await runner.query(query, params);
      return {
        data: {
          rows: result.rows,
          rowCount: result.rowCount ?? 0,
          durationMs: Date.now() - startedAt,
        },
      };
    } finally {
      await runner.end();
    }
  }
}
