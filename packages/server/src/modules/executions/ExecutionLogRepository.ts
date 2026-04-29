import type { Pool } from "pg";
import { pgPool } from "../../config/database.js";
import type {
  ExecutionLog,
  IExecutionLogRepository,
} from "../../engine/types.js";

// ─── API-level types ──────────────────────────────────────────────────────────

export interface ApiExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  attempt: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  tokensUsed?: number;
}

export interface ApiExecution {
  id: string;
  tenantId: string;
  workflowId: string;
  status: string;
  triggerData?: unknown;
  steps: ApiExecutionStep[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

interface PaginationOpts {
  limit: number;
  offset: number;
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function rowToExecution(
  row: Record<string, unknown>,
  steps: ApiExecutionStep[] = []
): ApiExecution {
  return {
    id: row["id"] as string,
    tenantId: row["tenant_id"] as string,
    workflowId: row["workflow_id"] as string,
    status: row["status"] as string,
    triggerData: row["trigger_data"] as unknown,
    steps,
    startedAt: row["started_at"] as Date,
    completedAt: row["completed_at"] as Date | undefined,
    durationMs: row["duration_ms"] as number | undefined,
    error: row["error"] as string | undefined,
  };
}

function rowToStep(row: Record<string, unknown>): ApiExecutionStep {
  return {
    id: row["id"] as string,
    executionId: row["execution_id"] as string,
    nodeId: row["node_id"] as string,
    nodeType: row["node_type"] as string,
    status: row["status"] as string,
    input: row["input"] as unknown,
    output: row["output"] as unknown,
    error: row["error"] as string | undefined,
    attempt: (row["attempt"] as number) ?? 1,
    startedAt: row["started_at"] as Date | undefined,
    completedAt: row["completed_at"] as Date | undefined,
    durationMs: row["duration_ms"] as number | undefined,
    tokensUsed: row["tokens_used"] as number | undefined,
  };
}

// ─── ExecutionLogRepository ───────────────────────────────────────────────────

export class ExecutionLogRepository implements IExecutionLogRepository {
  constructor(private readonly pool: Pool = pgPool) {}

  // ── IExecutionLogRepository (used by WorkflowRunner) ─────────────────────

  async create(log: Omit<ExecutionLog, "id">): Promise<ExecutionLog> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO executions
         (tenant_id, workflow_id, status, trigger, started_at)
       VALUES ($1, $2, $3, 'manual', $4)
       RETURNING id, tenant_id, workflow_id, status, started_at`,
      [log.tenantId, log.workflowId, log.status, log.startedAt]
    );
    const row = rows[0];
    return {
      id: row["id"] as string,
      tenantId: row["tenant_id"] as string,
      workflowId: row["workflow_id"] as string,
      status: row["status"] as ExecutionLog["status"],
      startedAt: row["started_at"] as Date,
    };
  }

  async update(
    id: string,
    updates: Partial<Omit<ExecutionLog, "id">>
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      sets.push(`completed_at = $${idx++}`);
      values.push(updates.completedAt);
    }
    if (updates.error !== undefined) {
      sets.push(`error = $${idx++}`);
      values.push(updates.error);
    }

    if (sets.length === 0) return;

    values.push(id);
    await this.pool.query(
      `UPDATE executions SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
    );
  }

  // ── API methods ───────────────────────────────────────────────────────────

  async findById(id: string, tenantId: string): Promise<ApiExecution | null> {
    const { rows: execRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM executions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (execRows.length === 0) return null;

    const { rows: stepRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM execution_steps WHERE execution_id = $1 ORDER BY started_at ASC`,
      [id]
    );

    return rowToExecution(execRows[0], stepRows.map(rowToStep));
  }

  async findByWorkflowId(
    workflowId: string,
    tenantId: string,
    opts: PaginationOpts
  ): Promise<{ items: ApiExecution[]; total: number }> {
    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.pool.query<Record<string, unknown>>(
        `SELECT * FROM executions
         WHERE workflow_id = $1 AND tenant_id = $2
         ORDER BY started_at DESC
         LIMIT $3 OFFSET $4`,
        [workflowId, tenantId, opts.limit, opts.offset]
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM executions WHERE workflow_id = $1 AND tenant_id = $2`,
        [workflowId, tenantId]
      ),
    ]);

    return {
      items: rows.map((r) => rowToExecution(r)),
      total: Number(countRows[0]?.["count"] ?? 0),
    };
  }

  async cancel(id: string, tenantId: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE executions SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status IN ('running', 'pending')`,
      [id, tenantId]
    );
    return (rowCount ?? 0) > 0;
  }
}
