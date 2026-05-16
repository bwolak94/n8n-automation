import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import type { INode, NodeOutput, ExecutionContext } from "../../nodes/contracts/INode.js";
import { TenantNodeRegistry } from "../../modules/marketplace/TenantNodeRegistry.js";
import { NodeInstaller } from "../../modules/marketplace/NodeInstaller.js";
import { PackageValidator } from "../../modules/marketplace/PackageValidator.js";
import { ValidationError } from "../../shared/errors/index.js";
import type { MarketplaceRepository, PackageRecord, InstalledNodeRecord } from "../../modules/marketplace/MarketplaceRepository.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const UPLOAD_DIR = "/tmp/marketplace-test-installer";

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makePackageRecord(overrides: Partial<PackageRecord> = {}): PackageRecord {
  return {
    packageId: "pkg-1",
    name: "My Custom Node",
    version: "1.0.0",
    description: "A test node",
    author: "Test Author",
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

function makeTestINode(type = "custom-node"): INode {
  return {
    definition: { type, name: `Custom Node ${type}` },
    execute: async (_input: unknown, _config: Record<string, unknown>, _ctx: ExecutionContext): Promise<NodeOutput> => ({
      data: "test-output",
    }),
  };
}

// ─── TestNodeInstaller — overrides sandbox execution ─────────────────────────

class TestNodeInstaller extends NodeInstaller {
  private sandboxResult: unknown = null;

  setSandboxResult(result: unknown): void {
    this.sandboxResult = result;
  }

  protected override executeInSandbox(_nodeDir: string, _mainFile: string): unknown {
    return this.sandboxResult;
  }
}

// ─── Mock repository factory ──────────────────────────────────────────────────

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

// ─── Setup package directory in temp filesystem ───────────────────────────────

function createPackageDir(tenantId: string, packageId: string, manifest: object = {}): string {
  const dir = path.join(UPLOAD_DIR, tenantId, packageId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "my-node", version: "1.0.0", main: "index.js", ...manifest })
  );
  return dir;
}

function cleanPackageDir(tenantId: string, packageId: string): void {
  const dir = path.join(UPLOAD_DIR, tenantId, packageId);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("NodeInstaller", () => {
  let mockRepo: jest.Mocked<MarketplaceRepository>;
  let registry: TenantNodeRegistry;
  let installer: TestNodeInstaller;

  beforeEach(() => {
    mockRepo = makeRepo();
    registry = new TenantNodeRegistry();
    installer = new TestNodeInstaller(registry, mockRepo, new PackageValidator(), UPLOAD_DIR);
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  // ── install ────────────────────────────────────────────────────────────────

  describe("install", () => {
    it("registers node in TenantNodeRegistry on successful install", async () => {
      createPackageDir("tenant-1", "pkg-1");
      installer.setSandboxResult(makeTestINode("custom-node"));

      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());
      (mockRepo.installNode as jest.MockedFunction<typeof mockRepo.installNode>)
        .mockResolvedValue(makeInstalledRecord());
      (mockRepo.incrementDownloads as jest.MockedFunction<typeof mockRepo.incrementDownloads>)
        .mockResolvedValue(undefined);

      await installer.install("tenant-1", "pkg-1");

      expect(registry.hasForTenant("custom-node", "tenant-1")).toBe(true);
      expect(mockRepo.installNode).toHaveBeenCalledWith(
        "tenant-1", "pkg-1", "custom-node", "1.0.0"
      );
      expect(mockRepo.incrementDownloads).toHaveBeenCalledWith("pkg-1");
    });

    it("throws ValidationError when package not found in DB", async () => {
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(null);

      await expect(installer.install("tenant-1", "no-pkg")).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when package directory does not exist", async () => {
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());
      // No createPackageDir call → directory missing

      await expect(installer.install("tenant-1", "pkg-1")).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError when sandbox returns invalid INode (missing execute)", async () => {
      createPackageDir("tenant-1", "pkg-1");
      installer.setSandboxResult({ definition: { type: "t", name: "n" } }); // missing execute

      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());

      await expect(installer.install("tenant-1", "pkg-1")).rejects.toThrow(ValidationError);
    });

    it("second install of same package upserts (calls installNode twice)", async () => {
      createPackageDir("tenant-1", "pkg-1");
      installer.setSandboxResult(makeTestINode("custom-node"));

      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord({ version: "2.0.0" }));
      (mockRepo.installNode as jest.MockedFunction<typeof mockRepo.installNode>)
        .mockResolvedValue(makeInstalledRecord({ version: "2.0.0" }));
      (mockRepo.incrementDownloads as jest.MockedFunction<typeof mockRepo.incrementDownloads>)
        .mockResolvedValue(undefined);

      await installer.install("tenant-1", "pkg-1");
      const second = await installer.install("tenant-1", "pkg-1");

      expect(mockRepo.installNode).toHaveBeenCalledTimes(2);
      expect(second.version).toBe("2.0.0");
    });

    it("scans nested subdirectory source files (collectSourceFiles recursion)", async () => {
      const dir = createPackageDir("tenant-1", "pkg-1");
      // Create a subdirectory with a forbidden file to trigger the recursive path
      const subDir = path.join(dir, "lib");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "evil.js"), "const exec = require('child_process');");

      installer.setSandboxResult(makeTestINode("custom-node"));
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());

      await expect(installer.install("tenant-1", "pkg-1")).rejects.toThrow(ValidationError);
    });

    it("scans source files and blocks forbidden imports", async () => {
      const dir = createPackageDir("tenant-1", "pkg-1");
      // Write a file with forbidden require('fs')
      fs.writeFileSync(path.join(dir, "evil.js"), "const fs = require('fs');");

      installer.setSandboxResult(makeTestINode("custom-node"));
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());

      await expect(installer.install("tenant-1", "pkg-1")).rejects.toThrow(ValidationError);
    });

    it("installs a built-in package without loading from disk", async () => {
      // Register the node type so the registry has it
      registry.register(makeTestINode("slack"));
      const installed = makeInstalledRecord({ nodeType: "slack" });

      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord({ isBuiltIn: true, nodeType: "slack" }));
      (mockRepo.installNode as jest.MockedFunction<typeof mockRepo.installNode>)
        .mockResolvedValue(installed);
      (mockRepo.incrementDownloads as jest.MockedFunction<typeof mockRepo.incrementDownloads>)
        .mockResolvedValue(undefined);

      const result = await installer.install("tenant-1", "pkg-1");

      expect(result).toBe(installed);
      expect(mockRepo.installNode).toHaveBeenCalledWith("tenant-1", "pkg-1", "slack", "1.0.0");
      expect(mockRepo.incrementDownloads).toHaveBeenCalledWith("pkg-1");
    });

    it("throws ValidationError when built-in nodeType is not registered", async () => {
      // Do NOT register "slack" in the registry
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord({ isBuiltIn: true, nodeType: "slack" }));

      await expect(installer.install("tenant-1", "pkg-1")).rejects.toThrow(
        /has no registered node type/
      );
    });
  });

  // ── uninstall ──────────────────────────────────────────────────────────────

  describe("uninstall", () => {
    it("unregisters node from TenantNodeRegistry", async () => {
      registry.registerForTenant("tenant-1", makeTestINode("custom-node"));

      (mockRepo.findInstalledNode as jest.MockedFunction<typeof mockRepo.findInstalledNode>)
        .mockResolvedValue(makeInstalledRecord({ nodeType: "custom-node" }));
      (mockRepo.uninstallNode as jest.MockedFunction<typeof mockRepo.uninstallNode>)
        .mockResolvedValue(true);

      await installer.uninstall("tenant-1", "pkg-1");

      expect(registry.hasForTenant("custom-node", "tenant-1")).toBe(false);
      expect(mockRepo.uninstallNode).toHaveBeenCalledWith("tenant-1", "pkg-1");
    });

    it("throws ValidationError when package was not installed", async () => {
      (mockRepo.findInstalledNode as jest.MockedFunction<typeof mockRepo.findInstalledNode>)
        .mockResolvedValue(null);

      await expect(installer.uninstall("tenant-1", "not-installed")).rejects.toThrow(ValidationError);
    });
  });

  // ── loadInstalledNodes ─────────────────────────────────────────────────────

  describe("loadInstalledNodes", () => {
    it("skips packages whose directories are missing (no crash)", async () => {
      (mockRepo.findAllInstalled as jest.MockedFunction<typeof mockRepo.findAllInstalled>)
        .mockResolvedValue([makeInstalledRecord()]);
      // No directory created → existsSync returns false

      await expect(installer.loadInstalledNodes()).resolves.toBeUndefined();
      // Should NOT have registered anything
      expect(registry.hasForTenant("custom-node", "tenant-1")).toBe(false);
    });

    it("loads nodes from DB and registers them in TenantNodeRegistry", async () => {
      createPackageDir("tenant-1", "pkg-1");
      installer.setSandboxResult(makeTestINode("custom-node"));

      (mockRepo.findAllInstalled as jest.MockedFunction<typeof mockRepo.findAllInstalled>)
        .mockResolvedValue([makeInstalledRecord()]);
      (mockRepo.findPackageById as jest.MockedFunction<typeof mockRepo.findPackageById>)
        .mockResolvedValue(makePackageRecord());

      await installer.loadInstalledNodes();

      expect(registry.hasForTenant("custom-node", "tenant-1")).toBe(true);
    });
  });
});
