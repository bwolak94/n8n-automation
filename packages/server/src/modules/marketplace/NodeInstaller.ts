import path from "node:path";
import fs from "node:fs";
import { NodeVM } from "vm2";
import type { INode } from "../../nodes/contracts/INode.js";
import { ValidationError } from "../../shared/errors/index.js";
import type { TenantNodeRegistry } from "./TenantNodeRegistry.js";
import type { MarketplaceRepository, InstalledNodeRecord } from "./MarketplaceRepository.js";
import type { PackageValidator } from "./PackageValidator.js";

// ─── NodeInstaller ────────────────────────────────────────────────────────────
//
// Loads a marketplace package from an already-extracted directory,
// runs it in a vm2 sandbox, validates the INode interface,
// registers it in TenantNodeRegistry, and persists an InstalledNode record.

export class NodeInstaller {
  constructor(
    protected readonly tenantRegistry: TenantNodeRegistry,
    private readonly repository: MarketplaceRepository,
    private readonly validator: PackageValidator,
    private readonly uploadDir: string
  ) {}

  // ── Execute a package in a vm2 sandbox ────────────────────────────────────

  /* istanbul ignore next */
  protected executeInSandbox(nodeDir: string, mainFile: string): unknown {
    const vm = new NodeVM({
      console: "off",
      sandbox: {},
      require: {
        external: false,  // no npm packages
        builtin: [],      // no Node.js built-ins
        root: nodeDir,
        context: "host",
      },
    });

    const absoluteMain = path.join(nodeDir, mainFile);
    const source = fs.readFileSync(absoluteMain, "utf-8");
    return vm.run(source, absoluteMain);
  }

  // ── Install a package into a tenant ───────────────────────────────────────

  async install(tenantId: string, packageId: string): Promise<InstalledNodeRecord> {
    const pkg = await this.repository.findPackageById(packageId);
    if (!pkg) {
      throw new ValidationError(`Package '${packageId}' not found in the marketplace`);
    }

    // Built-in packages ship with the server — skip disk/sandbox loading.
    // The nodeType is already registered in the global NodeRegistry.
    if (pkg.isBuiltIn) {
      if (!this.tenantRegistry.has(pkg.nodeType)) {
        throw new ValidationError(
          `Built-in package '${pkg.name}' has no registered node type '${pkg.nodeType}'. Contact support.`
        );
      }
      const record = await this.repository.installNode(tenantId, packageId, pkg.nodeType, pkg.version);
      await this.repository.incrementDownloads(packageId);
      return record;
    }

    const nodeDir = path.join(this.uploadDir, tenantId, packageId);
    if (!fs.existsSync(nodeDir)) {
      throw new ValidationError(
        `Package directory not found for '${packageId}'. Has it been published correctly?`
      );
    }

    // Read and validate package.json
    const manifestPath = path.join(nodeDir, "package.json");
    const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown;
    const manifest = this.validator.validateManifest(manifestRaw);

    // Source security scan on all JS/TS files
    const sourceFiles = this.collectSourceFiles(nodeDir);
    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf-8");
      this.validator.validateSource(source, path.relative(nodeDir, filePath));
    }

    // Load and validate the node in a sandbox
    const candidate = this.executeInSandbox(nodeDir, manifest.main);
    this.validator.validateINode(candidate);

    const inode = candidate as INode;

    // Register in TenantNodeRegistry
    this.tenantRegistry.registerForTenant(tenantId, inode);

    // Persist the installation record (upsert — handles version upgrades)
    const record = await this.repository.installNode(tenantId, packageId, inode.definition.type, pkg.version);
    await this.repository.incrementDownloads(packageId);

    return record;
  }

  // ── Uninstall a package from a tenant ─────────────────────────────────────

  async uninstall(tenantId: string, packageId: string): Promise<void> {
    const installed = await this.repository.findInstalledNode(tenantId, packageId);
    if (!installed) {
      throw new ValidationError(`Package '${packageId}' is not installed for this tenant`);
    }

    this.tenantRegistry.unregisterForTenant(tenantId, installed.nodeType);
    await this.repository.uninstallNode(tenantId, packageId);
  }

  // ── Repopulate registry on server restart ─────────────────────────────────

  async loadInstalledNodes(): Promise<void> {
    const allInstalled = await this.repository.findAllInstalled();
    for (const record of allInstalled) {
      const nodeDir = path.join(this.uploadDir, record.tenantId, record.packageId);
      if (!fs.existsSync(nodeDir)) continue;

      try {
        const pkg = await this.repository.findPackageById(record.packageId);
        if (!pkg) continue;

        const manifestPath = path.join(nodeDir, "package.json");
        const manifest = this.validator.validateManifest(
          JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as unknown
        );
        const candidate = this.executeInSandbox(nodeDir, manifest.main);
        this.validator.validateINode(candidate);
        this.tenantRegistry.registerForTenant(record.tenantId, candidate as INode);
      } catch { /* istanbul ignore next */ // Skip packages that fail to load on startup — don't crash the server
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private collectSourceFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        results.push(...this.collectSourceFiles(full));
      } else if (entry.isFile() && /\.(js|ts|mjs|cjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }
}
