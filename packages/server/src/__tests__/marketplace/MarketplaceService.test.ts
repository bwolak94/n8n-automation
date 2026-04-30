import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { MarketplaceService } from "../../modules/marketplace/MarketplaceService.js";
import { PackageValidator } from "../../modules/marketplace/PackageValidator.js";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { MarketplaceRepository, PackageRecord, InstalledNodeRecord } from "../../modules/marketplace/MarketplaceRepository.js";
import type { NodeInstaller } from "../../modules/marketplace/NodeInstaller.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePackageRecord(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    packageId: "pkg-1",
    name: "Test Node",
    version: "1.0.0",
    description: "",
    author: "Alice",
    nodeType: "custom-node",
    category: "integrations",
    tags: [],
    permissions: ["http"],
    status: "approved",
    publisherId: "user-1",
    downloads: 0,
    rating: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInstalledRecord(overrides: Partial<InstalledNodeRecord> = {}): InstalledNodeRecord {
  return {
    tenantId: "tenant-1",
    packageId: "pkg-1",
    nodeType: "custom-node",
    version: "1.0.0",
    installedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(): jest.Mocked<MarketplaceRepository> {
  return {
    findPackageById:     jest.fn(),
    createPackage:       jest.fn(),
    listPackages:        jest.fn(),
    updatePackageStatus: jest.fn(),
    incrementDownloads:  jest.fn(),
    installNode:         jest.fn(),
    uninstallNode:       jest.fn(),
    listInstalledNodes:  jest.fn(),
    findInstalledNode:   jest.fn(),
    findAllInstalled:    jest.fn(),
  } as unknown as jest.Mocked<MarketplaceRepository>;
}

function makeInstaller(): jest.Mocked<NodeInstaller> {
  return {
    install:             jest.fn(),
    uninstall:           jest.fn(),
    loadInstalledNodes:  jest.fn(),
  } as unknown as jest.Mocked<NodeInstaller>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MarketplaceService", () => {
  let repo: jest.Mocked<MarketplaceRepository>;
  let installer: jest.Mocked<NodeInstaller>;
  let service: MarketplaceService;

  beforeEach(() => {
    repo = makeRepo();
    installer = makeInstaller();
    service = new MarketplaceService(repo, new PackageValidator(), installer);
  });

  // ── listPackages ───────────────────────────────────────────────────────────

  describe("listPackages", () => {
    it("returns approved packages from repository", async () => {
      const pkgs = [makePackageRecord(), makePackageRecord({ packageId: "pkg-2", nodeType: "node-2" })];
      (repo.listPackages as jest.MockedFunction<typeof repo.listPackages>)
        .mockResolvedValue({ items: pkgs, total: 2 });

      const result = await service.listPackages({ search: "node" });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(repo.listPackages).toHaveBeenCalledWith(
        expect.objectContaining({ status: "approved", search: "node" })
      );
    });
  });

  // ── publishPackage ─────────────────────────────────────────────────────────

  describe("publishPackage", () => {
    it("creates a package record in pending_review status", async () => {
      const pending = makePackageRecord({ status: "pending_review" });
      (repo.createPackage as jest.MockedFunction<typeof repo.createPackage>)
        .mockResolvedValue(pending);

      const result = await service.publishPackage({
        name: "Test Node",
        version: "1.0.0",
        author: "Alice",
        nodeType: "custom-node",
        configObject: { nodeType: "custom-node", permissions: ["http"] },
        publisherId: "user-1",
      });

      expect(repo.createPackage).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test Node", nodeType: "custom-node" })
      );
      expect(result.status).toBe("pending_review");
    });

    it("throws ValidationError when nodeType doesn't match config", async () => {
      await expect(
        service.publishPackage({
          name: "Test Node",
          version: "1.0.0",
          author: "Alice",
          nodeType: "different-type",
          configObject: { nodeType: "actual-type", permissions: ["http"] },
          publisherId: "user-1",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when config has forbidden permission", async () => {
      await expect(
        service.publishPackage({
          name: "Bad Node",
          version: "1.0.0",
          author: "Alice",
          nodeType: "bad-node",
          configObject: { nodeType: "bad-node", permissions: ["fs"] },
          publisherId: "user-1",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── installPackage ─────────────────────────────────────────────────────────

  describe("installPackage", () => {
    it("delegates to NodeInstaller for approved packages", async () => {
      (repo.findPackageById as jest.MockedFunction<typeof repo.findPackageById>)
        .mockResolvedValue(makePackageRecord({ status: "approved" }));
      (installer.install as jest.MockedFunction<typeof installer.install>)
        .mockResolvedValue(makeInstalledRecord());

      const record = await service.installPackage("tenant-1", "pkg-1");

      expect(installer.install).toHaveBeenCalledWith("tenant-1", "pkg-1");
      expect(record.packageId).toBe("pkg-1");
    });

    it("throws NotFoundError when package doesn't exist", async () => {
      (repo.findPackageById as jest.MockedFunction<typeof repo.findPackageById>)
        .mockResolvedValue(null);

      await expect(service.installPackage("tenant-1", "nonexistent")).rejects.toThrow(NotFoundError);
    });

    it("throws ValidationError when package is not approved", async () => {
      (repo.findPackageById as jest.MockedFunction<typeof repo.findPackageById>)
        .mockResolvedValue(makePackageRecord({ status: "pending_review" }));

      await expect(service.installPackage("tenant-1", "pkg-1")).rejects.toThrow(ValidationError);
    });
  });

  // ── uninstallPackage ───────────────────────────────────────────────────────

  describe("uninstallPackage", () => {
    it("delegates to NodeInstaller", async () => {
      (repo.findPackageById as jest.MockedFunction<typeof repo.findPackageById>)
        .mockResolvedValue(makePackageRecord());
      (installer.uninstall as jest.MockedFunction<typeof installer.uninstall>)
        .mockResolvedValue(undefined);

      await service.uninstallPackage("tenant-1", "pkg-1");

      expect(installer.uninstall).toHaveBeenCalledWith("tenant-1", "pkg-1");
    });

    it("throws NotFoundError when package doesn't exist", async () => {
      (repo.findPackageById as jest.MockedFunction<typeof repo.findPackageById>)
        .mockResolvedValue(null);

      await expect(service.uninstallPackage("tenant-1", "nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  // ── listInstalled ──────────────────────────────────────────────────────────

  describe("listInstalled", () => {
    it("returns installed nodes for tenant", async () => {
      const records = [makeInstalledRecord(), makeInstalledRecord({ packageId: "pkg-2", nodeType: "node-2" })];
      (repo.listInstalledNodes as jest.MockedFunction<typeof repo.listInstalledNodes>)
        .mockResolvedValue(records);

      const result = await service.listInstalled("tenant-1");

      expect(result).toHaveLength(2);
      expect(repo.listInstalledNodes).toHaveBeenCalledWith("tenant-1");
    });
  });

  // ── approvePackage / rejectPackage ─────────────────────────────────────────

  describe("approvePackage", () => {
    it("updates package status to approved", async () => {
      (repo.updatePackageStatus as jest.MockedFunction<typeof repo.updatePackageStatus>)
        .mockResolvedValue(true);

      await expect(service.approvePackage("pkg-1")).resolves.toBeUndefined();
      expect(repo.updatePackageStatus).toHaveBeenCalledWith("pkg-1", "approved");
    });

    it("throws NotFoundError when package doesn't exist", async () => {
      (repo.updatePackageStatus as jest.MockedFunction<typeof repo.updatePackageStatus>)
        .mockResolvedValue(false);

      await expect(service.approvePackage("ghost")).rejects.toThrow(NotFoundError);
    });
  });

  describe("rejectPackage", () => {
    it("updates package status to rejected", async () => {
      (repo.updatePackageStatus as jest.MockedFunction<typeof repo.updatePackageStatus>)
        .mockResolvedValue(true);

      await service.rejectPackage("pkg-1");
      expect(repo.updatePackageStatus).toHaveBeenCalledWith("pkg-1", "rejected");
    });
  });
});
