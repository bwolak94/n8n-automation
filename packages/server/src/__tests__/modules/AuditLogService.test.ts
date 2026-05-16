import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AuditLogService } from "../../modules/audit/AuditLogService.js";
import type { AuditLogRepository, AuditLogEntry, AuditLogFilters, AuditLogPage } from "../../modules/audit/AuditLogRepository.js";
import type { AuditLog } from "@automation-hub/shared";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    tenantId:   "tenant-1",
    actorId:    "user-1",
    actorEmail: "alice@example.com",
    ipAddress:  "1.2.3.4",
    eventType:  "workflow.created",
    entityType: "workflow",
    entityId:   "wf-abc",
    metadata:   { name: "My Workflow" },
    ...overrides,
  };
}

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id:         "aud-1",
    tenantId:   "tenant-1",
    actorId:    "user-1",
    actorEmail: "alice@example.com",
    ipAddress:  "1.2.3.4",
    eventType:  "workflow.created",
    entityType: "workflow",
    entityId:   "wf-abc",
    metadata:   { name: "My Workflow" },
    createdAt:  new Date("2024-06-01T10:00:00Z"),
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AuditLogRepository> = {}): AuditLogRepository {
  return {
    append:        jest.fn<AuditLogRepository["append"]>().mockResolvedValue(undefined),
    query:         jest.fn<AuditLogRepository["query"]>(),
    exportRows:    jest.fn<AuditLogRepository["exportRows"]>(),
    deleteOlderThan: jest.fn<AuditLogRepository["deleteOlderThan"]>().mockResolvedValue(0),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AuditLogService", () => {
  let repo: AuditLogRepository;
  let service: AuditLogService;

  beforeEach(() => {
    repo    = makeRepo();
    service = new AuditLogService(repo);
  });

  // ── log() ─────────────────────────────────────────────────────────────────

  describe("log()", () => {
    it("calls repo.append with the given entry", async () => {
      const entry = makeEntry();
      service.log(entry);
      // Give the microtask a tick to run
      await Promise.resolve();
      expect(repo.append).toHaveBeenCalledWith(entry);
    });

    it("is non-blocking — returns synchronously without awaiting DB", () => {
      // append never resolves — log() must still return immediately
      (repo.append as jest.Mock).mockReturnValue(new Promise(() => {}));
      const start = Date.now();
      service.log(makeEntry());
      expect(Date.now() - start).toBeLessThan(50);
    });

    it("does not throw when repo.append rejects", async () => {
      (repo.append as jest.Mock).mockRejectedValue(new Error("DB down"));
      const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
      service.log(makeEntry());
      await new Promise((r) => setTimeout(r, 10));
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("[audit]"));
      stderrSpy.mockRestore();
    });
  });

  // ── query() ───────────────────────────────────────────────────────────────

  describe("query()", () => {
    it("delegates to repo.query with correct args", async () => {
      const page: AuditLogPage = { items: [makeLog()], total: 1, limit: 50, offset: 0 };
      (repo.query as jest.Mock<AuditLogRepository["query"]>).mockResolvedValue(page);

      const filters: AuditLogFilters = { eventType: "workflow.created" };
      const result = await service.query("tenant-1", filters, { limit: 50, offset: 0 });

      expect(repo.query).toHaveBeenCalledWith("tenant-1", filters, { limit: 50, offset: 0 });
      expect(result).toEqual(page);
    });

    it("returns paginated results with filters applied", async () => {
      const logs = [
        makeLog({ eventType: "workflow.created" }),
        makeLog({ id: "aud-2", eventType: "workflow.deleted" }),
      ];
      const page: AuditLogPage = { items: logs, total: 2, limit: 10, offset: 0 };
      (repo.query as jest.Mock<AuditLogRepository["query"]>).mockResolvedValue(page);

      const result = await service.query("tenant-1", {}, { limit: 10, offset: 0 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ── exportCsv() ───────────────────────────────────────────────────────────

  describe("exportCsv()", () => {
    it("returns CSV with header row", async () => {
      (repo.exportRows as jest.Mock<AuditLogRepository["exportRows"]>).mockResolvedValue([makeLog()]);
      const csv = await service.exportCsv("tenant-1", {});
      const lines = csv.split("\n");
      expect(lines[0]).toBe("id,tenantId,actorId,actorEmail,ipAddress,eventType,entityType,entityId,createdAt");
    });

    it("escapes double quotes in CSV values", async () => {
      const log = makeLog({ actorEmail: 'say "hello"@example.com' });
      (repo.exportRows as jest.Mock<AuditLogRepository["exportRows"]>).mockResolvedValue([log]);
      const csv = await service.exportCsv("tenant-1", {});
      expect(csv).toContain('""hello""');
    });

    it("limits export to 50 000 rows", async () => {
      (repo.exportRows as jest.Mock<AuditLogRepository["exportRows"]>).mockResolvedValue([]);
      await service.exportCsv("tenant-1", {});
      expect(repo.exportRows).toHaveBeenCalledWith("tenant-1", {}, 50_000);
    });

    it("returns empty body with just header when no records", async () => {
      (repo.exportRows as jest.Mock<AuditLogRepository["exportRows"]>).mockResolvedValue([]);
      const csv = await service.exportCsv("tenant-1", {});
      const lines = csv.split("\n");
      expect(lines).toHaveLength(2); // header + empty body line
    });
  });

  // ── runRetentionCleanup() ─────────────────────────────────────────────────

  describe("runRetentionCleanup()", () => {
    it("calculates cutoff date from retentionDays and calls deleteOlderThan", async () => {
      (repo.deleteOlderThan as jest.Mock<AuditLogRepository["deleteOlderThan"]>).mockResolvedValue(42);

      const before = new Date();
      const result = await service.runRetentionCleanup(30);
      const after  = new Date();

      expect(result).toBe(42);

      const [cutoff] = (repo.deleteOlderThan as jest.Mock).mock.calls[0] as [Date];
      const expectedMin = new Date(before); expectedMin.setDate(expectedMin.getDate() - 30);
      const expectedMax = new Date(after);  expectedMax.setDate(expectedMax.getDate() - 30);
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
    });
  });
});
