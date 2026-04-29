export interface DatabaseCredential {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
}

export interface ICredentialStore {
  get(
    connectionId: string,
    tenantId: string
  ): Promise<DatabaseCredential | null>;
}

export interface DbQueryResult {
  rows: Record<string, unknown>[];
  rowCount: number | null;
}

export interface QueryRunner {
  query(sql: string, params?: unknown[]): Promise<DbQueryResult>;
  end(): Promise<void>;
}

export type PoolFactory = (credential: DatabaseCredential) => QueryRunner;
