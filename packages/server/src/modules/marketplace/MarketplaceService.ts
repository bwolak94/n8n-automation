import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { PackageStatus } from "./MarketplacePackage.model.js";
import type {
  MarketplaceRepository,
  PackageRecord,
  InstalledNodeRecord,
  CreatePackageInput,
  ListPackagesQuery,
} from "./MarketplaceRepository.js";
import type { PackageValidator } from "./PackageValidator.js";
import type { NodeInstaller } from "./NodeInstaller.js";

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface PublishPackageData {
  name: string;
  version: string;
  description?: string;
  author: string;
  nodeType: string;
  category?: string;
  tags?: string[];
  permissions?: string[];
  configObject: unknown; // automation-hub.config.ts exported object
  publisherId: string;
}

export interface ListPackagesResult {
  items: PackageRecord[];
  total: number;
}

// ─── MarketplaceService ───────────────────────────────────────────────────────

export class MarketplaceService {
  constructor(
    private readonly repository: MarketplaceRepository,
    private readonly validator: PackageValidator,
    private readonly installer: NodeInstaller
  ) {}

  // ── List approved packages ─────────────────────────────────────────────────

  async listPackages(query: ListPackagesQuery = {}): Promise<ListPackagesResult> {
    return this.repository.listPackages({ ...query, status: PackageStatus.APPROVED });
  }

  // ── Publish a new package (starts in pending_review) ──────────────────────

  async publishPackage(data: PublishPackageData): Promise<PackageRecord> {
    // Validate the automation-hub config
    const config = this.validator.validateConfig(data.configObject);

    // Ensure nodeType in config matches the submitted nodeType
    if (config.nodeType !== data.nodeType) {
      throw new ValidationError(
        `nodeType '${data.nodeType}' does not match config nodeType '${config.nodeType}'`
      );
    }

    const input: CreatePackageInput = {
      name:        data.name,
      version:     data.version,
      description: data.description,
      author:      data.author,
      nodeType:    data.nodeType,
      category:    data.category ?? config.category,
      tags:        data.tags,
      permissions: config.permissions,
      publisherId: data.publisherId,
    };

    return this.repository.createPackage(input);
  }

  // ── Install a package into a tenant workspace ──────────────────────────────

  async installPackage(tenantId: string, packageId: string): Promise<InstalledNodeRecord> {
    const pkg = await this.repository.findPackageById(packageId);
    if (!pkg) throw new NotFoundError(`Package '${packageId}' not found`);
    if (pkg.status !== PackageStatus.APPROVED) {
      throw new ValidationError(`Package '${packageId}' is not approved for installation`);
    }

    return this.installer.install(tenantId, packageId);
  }

  // ── Uninstall a package from a tenant workspace ───────────────────────────

  async uninstallPackage(tenantId: string, packageId: string): Promise<void> {
    const pkg = await this.repository.findPackageById(packageId);
    if (!pkg) throw new NotFoundError(`Package '${packageId}' not found`);

    await this.installer.uninstall(tenantId, packageId);
  }

  // ── List installed nodes for a tenant ─────────────────────────────────────

  async listInstalled(tenantId: string): Promise<InstalledNodeRecord[]> {
    return this.repository.listInstalledNodes(tenantId);
  }

  // ── Admin: approve/reject a package ───────────────────────────────────────

  async approvePackage(packageId: string): Promise<void> {
    const updated = await this.repository.updatePackageStatus(packageId, PackageStatus.APPROVED);
    if (!updated) throw new NotFoundError(`Package '${packageId}' not found`);
  }

  async rejectPackage(packageId: string): Promise<void> {
    const updated = await this.repository.updatePackageStatus(packageId, PackageStatus.REJECTED);
    if (!updated) throw new NotFoundError(`Package '${packageId}' not found`);
  }
}
