import type { Pool } from "pg";
import { pgPool } from "../../config/database.js";
import type { AuditLog } from "@automation-hub/shared";

// ─── Entry / filter types ─────────────────────────────────────────────────────

export interface AuditLogEntry {
  tenantId:    string;
  actorId:     string;
  actorEmail?: string;
  ipAddress?:  string;
  userAgent?:  string;
  eventType:   string;
  entityType?: string;
  entityId?:   string;
  metadata?:   Record<string, unknown>;
}

export interface AuditLogFilters {
  eventType?:  string;
  actorId?:    string;
  entityType?: string;
  entityId?:   string;
  from?:       Date;
  to?:         Date;
}

export interface AuditLogPage {
  items:  AuditLog[];
  total:  number;
  limit:  number;
  offset: number;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id:         row["id"] as string,
    tenantId:   row["tenant_id"] as string,
    actorId:    row["actor_id"] as string,
    actorEmail: (row["actor_email"] as string | null) ?? undefined,
    ipAddress:  (row["ip_address"] as string | null) ?? undefined,
    userAgent:  (row["user_agent"] as string | null) ?? undefined,
    eventType:  row["event_type"] as string,
    entityType: (row["entity_type"] as string | null) ?? undefined,
    entityId:   (row["entity_id"] as string | null) ?? undefined,
    metadata:   (row["metadata"] as Record<string, unknown> | null) ?? undefined,
    createdAt:  row["created_at"] as Date,
  };
}

// ─── AuditLogRepository ───────────────────────────────────────────────────────

export class AuditLogRepository {
  constructor(private readonly pool: Pool = pgPool) {}

  /** Append-only insert — no UPDATE or DELETE exposed in the application layer. */
  async append(entry: AuditLogEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs
         (tenant_id, actor_id, actor_email, ip_address, user_agent,
          event_type, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.tenantId,
        entry.actorId,
        entry.actorEmail ?? null,
        entry.ipAddress   ?? null,
        entry.userAgent   ?? null,
        entry.eventType,
        entry.entityType  ?? null,
        entry.entityId    ?? null,
        entry.metadata    ? JSON.stringify(entry.metadata) : null,
      ]
    );
  }

  async query(
    tenantId:   string,
    filters:    AuditLogFilters,
    pagination: { limit: number; offset: number }
  ): Promise<AuditLogPage> {
    const conditions: string[] = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filters.eventType)  { conditions.push(`event_type = $${idx++}`);   values.push(filters.eventType); }
    if (filters.actorId)    { conditions.push(`actor_id = $${idx++}`);     values.push(filters.actorId); }
    if (filters.entityType) { conditions.push(`entity_type = $${idx++}`);  values.push(filters.entityType); }
    if (filters.entityId)   { conditions.push(`entity_id = $${idx++}`);    values.push(filters.entityId); }
    if (filters.from)       { conditions.push(`created_at >= $${idx++}`);  values.push(filters.from); }
    if (filters.to)         { conditions.push(`created_at <= $${idx++}`);  values.push(filters.to); }

    const where = conditions.join(" AND ");

    const [{ rows }, { rows: countRows }] = await Promise.all([
      this.pool.query<Record<string, unknown>>(
        `SELECT * FROM audit_logs
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, pagination.limit, pagination.offset]
      ),
      this.pool.query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM audit_logs WHERE ${where}`,
        values
      ),
    ]);

    return {
      items:  rows.map(rowToAuditLog),
      total:  Number(countRows[0]?.["count"] ?? 0),
      limit:  pagination.limit,
      offset: pagination.offset,
    };
  }

  /** Returns up to maxRows rows for CSV export. */
  async exportRows(
    tenantId: string,
    filters:  AuditLogFilters,
    maxRows = 50_000
  ): Promise<AuditLog[]> {
    const conditions: string[] = ["tenant_id = $1"];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filters.eventType)  { conditions.push(`event_type = $${idx++}`);   values.push(filters.eventType); }
    if (filters.actorId)    { conditions.push(`actor_id = $${idx++}`);     values.push(filters.actorId); }
    if (filters.entityType) { conditions.push(`entity_type = $${idx++}`);  values.push(filters.entityType); }
    if (filters.entityId)   { conditions.push(`entity_id = $${idx++}`);    values.push(filters.entityId); }
    if (filters.from)       { conditions.push(`created_at >= $${idx++}`);  values.push(filters.from); }
    if (filters.to)         { conditions.push(`created_at <= $${idx++}`);  values.push(filters.to); }

    const where = conditions.join(" AND ");

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM audit_logs
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
      [...values, maxRows]
    );

    return rows.map(rowToAuditLog);
  }

  /** Used by the nightly retention cleanup job only. */
  async deleteOlderThan(cutoff: Date): Promise<number> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM audit_logs WHERE created_at < $1`,
      [cutoff]
    );
    return rowCount ?? 0;
  }
}
