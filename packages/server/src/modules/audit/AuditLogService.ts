import type { AuditLog } from "@automation-hub/shared";
import type {
  AuditLogRepository,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogPage,
} from "./AuditLogRepository.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPORT_ROW_LIMIT = 50_000;

const CSV_HEADERS: (keyof AuditLog)[] = [
  "id", "tenantId", "actorId", "actorEmail",
  "ipAddress", "eventType", "entityType", "entityId", "createdAt",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCsvRow(log: AuditLog): string {
  return CSV_HEADERS.map((key) => {
    const val = log[key];
    if (val === undefined || val === null) return "";
    const str = val instanceof Date ? val.toISOString() : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  }).join(",");
}

// ─── AuditLogService ──────────────────────────────────────────────────────────

export class AuditLogService {
  constructor(private readonly repo: AuditLogRepository) {}

  /**
   * Fire-and-forget audit write — never blocks the request/response cycle.
   * Failed writes are logged to stderr but do not propagate to callers.
   */
  log(entry: AuditLogEntry): void {
    this.repo.append(entry).catch((err: unknown) => {
      process.stderr.write(`[audit] Failed to write audit log: ${String(err)}\n`);
    });
  }

  async query(
    tenantId:   string,
    filters:    AuditLogFilters,
    pagination: { limit: number; offset: number }
  ): Promise<AuditLogPage> {
    return this.repo.query(tenantId, filters, pagination);
  }

  async exportCsv(tenantId: string, filters: AuditLogFilters): Promise<string> {
    const rows   = await this.repo.exportRows(tenantId, filters, EXPORT_ROW_LIMIT);
    const header = CSV_HEADERS.join(",");
    const body   = rows.map(toCsvRow).join("\n");
    return `${header}\n${body}`;
  }

  async runRetentionCleanup(retentionDays: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    return this.repo.deleteOlderThan(cutoff);
  }
}
