import type { Pool } from "pg";
import { pgPool } from "../../config/database.js";
import { createHash } from "node:crypto";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface ApprovalDecision {
  reviewer: string;
  decision: "approved" | "rejected";
  comment?: string;
  decidedAt: string; // ISO string
}

export interface Approval {
  readonly id: string;
  readonly executionId: string;
  readonly nodeId: string;
  readonly tenantId: string;
  readonly status: "pending" | "approved" | "rejected" | "expired";
  readonly reviewers: string[];
  readonly decisions: ApprovalDecision[];
  readonly requireAll: boolean;
  readonly timeoutAction: "approve" | "reject";
  readonly decisionBy?: string;
  readonly comment?: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly decidedAt?: Date;
}

export interface CreateApprovalData {
  executionId: string;
  nodeId: string;
  tenantId: string;
  reviewers: string[];
  requireAll: boolean;
  timeoutAction: "approve" | "reject";
  expiresAt: Date;
}

export interface UpdateApprovalData {
  status?: Approval["status"];
  decisions?: ApprovalDecision[];
  decisionBy?: string;
  comment?: string;
  decidedAt?: Date;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToApproval(row: Record<string, unknown>): Approval {
  return {
    id:            row["id"] as string,
    executionId:   row["execution_id"] as string,
    nodeId:        row["node_id"] as string,
    tenantId:      row["tenant_id"] as string,
    status:        row["status"] as Approval["status"],
    reviewers:     (row["reviewers"] as string[]) ?? [],
    decisions:     (row["decisions"] as ApprovalDecision[]) ?? [],
    requireAll:    Boolean(row["require_all"]),
    timeoutAction: (row["timeout_action"] as "approve" | "reject") ?? "reject",
    decisionBy:    row["decision_by"] as string | undefined,
    comment:       row["comment"] as string | undefined,
    tokenHash:     row["token_hash"] as string,
    expiresAt:     row["expires_at"] as Date,
    createdAt:     row["created_at"] as Date,
    decidedAt:     row["decided_at"] as Date | undefined,
  };
}

// ─── ApprovalRepository ───────────────────────────────────────────────────────

export class ApprovalRepository {
  constructor(private readonly pool: Pool = pgPool) {}

  async create(data: CreateApprovalData): Promise<Approval> {
    const tokenHash = createHash("sha256")
      .update(`${data.executionId}:${data.nodeId}:${data.tenantId}`)
      .digest("hex");

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO approvals
         (execution_id, node_id, tenant_id, reviewers, require_all, timeout_action, expires_at, token_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [data.executionId, data.nodeId, data.tenantId, data.reviewers, data.requireAll, data.timeoutAction, data.expiresAt, tokenHash]
    );
    return rowToApproval(rows[0]!);
  }

  async findById(id: string, tenantId?: string): Promise<Approval | null> {
    const params: unknown[] = [id];
    let sql = `SELECT * FROM approvals WHERE id = $1`;
    if (tenantId) {
      sql += ` AND tenant_id = $2`;
      params.push(tenantId);
    }
    const { rows } = await this.pool.query<Record<string, unknown>>(sql, params);
    return rows.length > 0 ? rowToApproval(rows[0]!) : null;
  }

  async findByExecutionId(executionId: string, tenantId: string): Promise<Approval[]> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM approvals
       WHERE execution_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [executionId, tenantId]
    );
    return rows.map(rowToApproval);
  }

  async update(id: string, data: UpdateApprovalData): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.status    !== undefined) { sets.push(`status = $${idx++}`);      values.push(data.status); }
    if (data.decisions !== undefined) { sets.push(`decisions = $${idx++}`);   values.push(JSON.stringify(data.decisions)); }
    if (data.decisionBy!== undefined) { sets.push(`decision_by = $${idx++}`); values.push(data.decisionBy); }
    if (data.comment   !== undefined) { sets.push(`comment = $${idx++}`);     values.push(data.comment); }
    if (data.decidedAt !== undefined) { sets.push(`decided_at = $${idx++}`);  values.push(data.decidedAt); }

    if (sets.length === 0) return;

    values.push(id);
    await this.pool.query(
      `UPDATE approvals SET ${sets.join(", ")} WHERE id = $${idx}`,
      values
    );
  }

  /** Patch the node output in the suspended execution state for branch routing. */
  async patchSuspendedNodeOutput(
    executionId: string,
    nodeId: string,
    output: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE executions
         SET resume_data = jsonb_set(resume_data, ARRAY['outputs', $2], $3::jsonb)
       WHERE id = $1`,
      [executionId, nodeId, JSON.stringify(output)]
    );
  }
}
