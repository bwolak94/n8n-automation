import type { Pool } from "pg";

export interface DailyVolume {
  date: string;   // YYYY-MM-DD
  success: number;
  failed: number;
}

export interface NodeTypeUsage {
  type: string;
  count: number;
}

export interface ExecutionStats {
  executionsThisMonth: number;
  successCount: number;
  failedCount: number;
  aiTokensUsed: number;
  volumeByDay: DailyVolume[];
  nodeTypeUsage: NodeTypeUsage[];
}

export interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  durationMs?: number;
  startedAt: Date;
}

export class AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async getStats(tenantId: string): Promise<ExecutionStats> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [statsResult, volumeResult, nodeResult, tokenResult] = await Promise.all([
      // Monthly execution counts
      this.pool.query<Record<string, unknown>>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'completed') AS success_count,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
         FROM executions
         WHERE tenant_id = $1 AND started_at >= $2`,
        [tenantId, monthStart]
      ),
      // Daily volume last 30 days
      this.pool.query<Record<string, unknown>>(
        `SELECT
           DATE(started_at) AS day,
           COUNT(*) FILTER (WHERE status = 'completed') AS success,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed
         FROM executions
         WHERE tenant_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
         GROUP BY day
         ORDER BY day ASC`,
        [tenantId]
      ),
      // Node type usage from steps in last 30 days
      this.pool.query<Record<string, unknown>>(
        `SELECT es.node_type AS type, COUNT(*) AS count
         FROM execution_steps es
         JOIN executions e ON e.id = es.execution_id
         WHERE e.tenant_id = $1 AND e.started_at >= NOW() - INTERVAL '30 days'
         GROUP BY es.node_type
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId]
      ),
      // AI tokens used this month
      this.pool.query<Record<string, unknown>>(
        `SELECT COALESCE(SUM(es.tokens_used), 0) AS tokens
         FROM execution_steps es
         JOIN executions e ON e.id = es.execution_id
         WHERE e.tenant_id = $1 AND e.started_at >= $2 AND es.tokens_used IS NOT NULL`,
        [tenantId, monthStart]
      ),
    ]);

    const statsRow = statsResult.rows[0] ?? {};

    return {
      executionsThisMonth: Number(statsRow["total"] ?? 0),
      successCount: Number(statsRow["success_count"] ?? 0),
      failedCount: Number(statsRow["failed_count"] ?? 0),
      aiTokensUsed: Number(tokenResult.rows[0]?.["tokens"] ?? 0),
      volumeByDay: volumeResult.rows.map((r) => ({
        date: String(r["day"]).slice(0, 10),
        success: Number(r["success"] ?? 0),
        failed: Number(r["failed"] ?? 0),
      })),
      nodeTypeUsage: nodeResult.rows.map((r) => ({
        type: String(r["type"]),
        count: Number(r["count"]),
      })),
    };
  }

  async getRecentExecutions(tenantId: string, limit = 10): Promise<RecentExecution[]> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id, workflow_id, status, duration_ms, started_at
       FROM executions
       WHERE tenant_id = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return rows.map((r) => ({
      id: String(r["id"]),
      workflowId: String(r["workflow_id"]),
      status: String(r["status"]),
      durationMs: r["duration_ms"] !== null ? Number(r["duration_ms"]) : undefined,
      startedAt: r["started_at"] as Date,
    }));
  }
}
