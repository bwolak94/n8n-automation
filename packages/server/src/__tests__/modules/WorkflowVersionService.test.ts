import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import type { WorkflowVersionRepository, VersionSummary, VersionDoc } from "../../modules/workflows/WorkflowVersionRepository.js";
import type { WorkflowRepository, ApiWorkflow } from "../../modules/workflows/WorkflowRepository.js";
import { WorkflowVersionService } from "../../modules/workflows/WorkflowVersionService.js";
import { NotFoundError } from "../../shared/errors/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<ApiWorkflow> = {}): ApiWorkflow {
  return {
    id: "wf-1",
    tenantId: "t-1",
    name: "My Workflow",
    status: "draft",
    nodes: [],
    edges: [],
    variables: {},
    tags: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function makeSummary(version: number, overrides: Partial<VersionSummary> = {}): VersionSummary {
  return {
    id: `ver-${version}`,
    workflowId: "wf-1",
    tenantId: "t-1",
    version,
    createdBy: "user-1",
    createdAt: new Date("2024-01-01"),
    autoSave: true,
    ...overrides,
  };
}

function makeVersionDoc(version: number, snapshot: ApiWorkflow, overrides: Partial<VersionDoc> = {}): VersionDoc {
  return {
    ...makeSummary(version),
    snapshot: snapshot as unknown as Record<string, unknown>,
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

function makeVersionRepo(overrides: Partial<WorkflowVersionRepository> = {}): WorkflowVersionRepository {
  return {
    createVersion: jest.fn<WorkflowVersionRepository["createVersion"]>(),
    listVersions: jest.fn<WorkflowVersionRepository["listVersions"]>(),
    getVersion: jest.fn<WorkflowVersionRepository["getVersion"]>(),
    tagVersion: jest.fn<WorkflowVersionRepository["tagVersion"]>(),
    pruneOldAutoSaves: jest.fn<WorkflowVersionRepository["pruneOldAutoSaves"]>().mockResolvedValue(0),
    ...overrides,
  } as WorkflowVersionRepository;
}

function makeWorkflowRepo(overrides: Partial<WorkflowRepository> = {}): WorkflowRepository {
  return {
    findById: jest.fn(),
    findByIdApi: jest.fn(),
    findByIdForWebhook: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    ...overrides,
  } as unknown as WorkflowRepository;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowVersionService", () => {
  let versionRepo: WorkflowVersionRepository;
  let workflowRepo: WorkflowRepository;
  let service: WorkflowVersionService;

  beforeEach(() => {
    versionRepo = makeVersionRepo();
    workflowRepo = makeWorkflowRepo();
    service = new WorkflowVersionService(versionRepo, workflowRepo);
  });

  // ── snapshotOnSave ──────────────────────────────────────────────────────────

  describe("snapshotOnSave", () => {
    it("creates a version and prunes auto-saves", async () => {
      const snapshot = makeSnapshot();
      const summary = makeSummary(1);
      (versionRepo.createVersion as jest.Mock).mockResolvedValue(summary);

      const result = await service.snapshotOnSave("wf-1", "t-1", snapshot, "user-1");

      expect(versionRepo.createVersion).toHaveBeenCalledWith(
        "wf-1",
        "t-1",
        snapshot,
        "user-1",
        { label: undefined, autoSave: true }
      );
      expect(versionRepo.pruneOldAutoSaves).toHaveBeenCalledWith("wf-1", 100);
      expect(result).toEqual(summary);
    });

    it("creates a labelled version with autoSave: false", async () => {
      const snapshot = makeSnapshot();
      const summary = makeSummary(2, { autoSave: false, label: "v1.0" });
      (versionRepo.createVersion as jest.Mock).mockResolvedValue(summary);

      await service.snapshotOnSave("wf-1", "t-1", snapshot, "user-1", "v1.0");

      expect(versionRepo.createVersion).toHaveBeenCalledWith(
        "wf-1",
        "t-1",
        snapshot,
        "user-1",
        { label: "v1.0", autoSave: false }
      );
    });
  });

  // ── pruneOldAutoSaves ───────────────────────────────────────────────────────

  describe("pruneOldAutoSaves (via repository)", () => {
    it("keeps 100 latest auto-saves when repository is called", async () => {
      await service.snapshotOnSave("wf-1", "t-1", makeSnapshot(), "user-1");
      expect(versionRepo.pruneOldAutoSaves).toHaveBeenCalledWith("wf-1", 100);
    });
  });

  // ── getVersion ─────────────────────────────────────────────────────────────

  describe("getVersion", () => {
    it("returns the version doc when found", async () => {
      const doc = makeVersionDoc(3, makeSnapshot());
      (versionRepo.getVersion as jest.Mock).mockResolvedValue(doc);

      const result = await service.getVersion("wf-1", "t-1", 3);
      expect(result).toEqual(doc);
    });

    it("throws NotFoundError when version does not exist", async () => {
      (versionRepo.getVersion as jest.Mock).mockResolvedValue(null);

      await expect(service.getVersion("wf-1", "t-1", 99)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  // ── restoreVersion ─────────────────────────────────────────────────────────

  describe("restoreVersion", () => {
    it("loads snapshot, updates workflow, and creates new version", async () => {
      const snap = makeSnapshot({ name: "Old Name", nodes: [] });
      const doc = makeVersionDoc(1, snap);
      const updatedWf = makeSnapshot({ name: "Old Name" });
      const newVersion = makeSummary(4, { label: "Restored from v1", autoSave: false });

      (versionRepo.getVersion as jest.Mock).mockResolvedValue(doc);
      (workflowRepo.update as jest.Mock).mockResolvedValue(updatedWf);
      (versionRepo.createVersion as jest.Mock).mockResolvedValue(newVersion);

      const result = await service.restoreVersion("wf-1", "t-1", 1, "user-1");

      expect(workflowRepo.update).toHaveBeenCalledWith("wf-1", "t-1", expect.objectContaining({
        name: "Old Name",
      }));
      expect(versionRepo.createVersion).toHaveBeenCalledWith(
        "wf-1",
        "t-1",
        updatedWf,
        "user-1",
        expect.objectContaining({ label: "Restored from v1" })
      );
      expect(result).toEqual(newVersion);
    });

    it("throws NotFoundError when version to restore does not exist", async () => {
      (versionRepo.getVersion as jest.Mock).mockResolvedValue(null);

      await expect(service.restoreVersion("wf-1", "t-1", 5, "user-1")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError when workflow no longer exists", async () => {
      const doc = makeVersionDoc(1, makeSnapshot());
      (versionRepo.getVersion as jest.Mock).mockResolvedValue(doc);
      (workflowRepo.update as jest.Mock).mockResolvedValue(null);

      await expect(service.restoreVersion("wf-1", "t-1", 1, "user-1")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("restore creates new version — never mutates history", async () => {
      const doc = makeVersionDoc(2, makeSnapshot());
      const updatedWf = makeSnapshot();
      (versionRepo.getVersion as jest.Mock).mockResolvedValue(doc);
      (workflowRepo.update as jest.Mock).mockResolvedValue(updatedWf);
      (versionRepo.createVersion as jest.Mock).mockResolvedValue(makeSummary(3));

      await service.restoreVersion("wf-1", "t-1", 2, "user-1");

      // Should create a new version, not modify version 2
      expect(versionRepo.createVersion).toHaveBeenCalledTimes(1);
    });
  });

  // ── compareVersions ────────────────────────────────────────────────────────

  describe("compareVersions", () => {
    it("returns empty array when snapshots are identical", async () => {
      const snap = makeSnapshot();
      (versionRepo.getVersion as jest.Mock)
        .mockResolvedValueOnce(makeVersionDoc(1, snap))
        .mockResolvedValueOnce(makeVersionDoc(2, snap));

      const result = await service.compareVersions("wf-1", "t-1", 1, 2);
      expect(result).toEqual([]);
    });

    it("returns replace op when name changes", async () => {
      const snap1 = makeSnapshot({ name: "Old" });
      const snap2 = makeSnapshot({ name: "New" });
      (versionRepo.getVersion as jest.Mock)
        .mockResolvedValueOnce(makeVersionDoc(1, snap1))
        .mockResolvedValueOnce(makeVersionDoc(2, snap2));

      const result = await service.compareVersions("wf-1", "t-1", 1, 2);
      expect(result).toContainEqual({ op: "replace", path: "/name", value: "New" });
    });

    it("detects added nodes array as replace", async () => {
      const snap1 = makeSnapshot({ nodes: [] });
      const snap2 = makeSnapshot({
        nodes: [{ id: "n1", type: "http", category: "action" as const, label: "HTTP", position: { x: 0, y: 0 }, config: {} }],
      });
      (versionRepo.getVersion as jest.Mock)
        .mockResolvedValueOnce(makeVersionDoc(1, snap1))
        .mockResolvedValueOnce(makeVersionDoc(2, snap2));

      const result = await service.compareVersions("wf-1", "t-1", 1, 2);
      const nodeOp = result.find((o) => o.path === "/nodes");
      expect(nodeOp).toBeDefined();
      expect(nodeOp?.op).toBe("replace");
    });

    it("throws NotFoundError when v1 is missing", async () => {
      (versionRepo.getVersion as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeVersionDoc(2, makeSnapshot()));

      await expect(service.compareVersions("wf-1", "t-1", 1, 2)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws NotFoundError when v2 is missing", async () => {
      (versionRepo.getVersion as jest.Mock)
        .mockResolvedValueOnce(makeVersionDoc(1, makeSnapshot()))
        .mockResolvedValueOnce(null);

      await expect(service.compareVersions("wf-1", "t-1", 1, 2)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
