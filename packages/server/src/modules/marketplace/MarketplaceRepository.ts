import { randomUUID } from "node:crypto";
import {
  MarketplacePackageModel,
  PackageStatus,
  type IMarketplacePackage,
} from "./MarketplacePackage.model.js";
import { InstalledNodeModel, type IInstalledNode } from "./InstalledNode.model.js";

// ─── Lean record types (plain objects, not Mongoose docs) ─────────────────────

export interface PackageRecord {
  packageId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  nodeType: string;
  category: string;
  tags: string[];
  permissions: string[];
  status: string;
  publisherId: string;
  tarballPath?: string;
  isBuiltIn: boolean;
  downloads: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstalledNodeRecord {
  tenantId: string;
  packageId: string;
  nodeType: string;
  version: string;
  installedAt: Date;
}

export interface CreatePackageInput {
  name: string;
  version: string;
  description?: string;
  author: string;
  nodeType: string;
  category?: string;
  tags?: string[];
  permissions?: string[];
  publisherId: string;
  tarballPath?: string;
}

export interface ListPackagesQuery {
  search?: string;
  category?: string;
  sort?: "downloads" | "rating" | "newest";
  limit?: number;
  offset?: number;
  status?: string;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class MarketplaceRepository {
  // ── Packages ────────────────────────────────────────────────────────────────

  async createPackage(input: CreatePackageInput): Promise<PackageRecord> {
    const doc = await MarketplacePackageModel.create({
      packageId: randomUUID(),
      name: input.name,
      version: input.version,
      description: input.description ?? "",
      author: input.author,
      nodeType: input.nodeType,
      category: input.category ?? "integrations",
      tags: input.tags ?? [],
      permissions: input.permissions ?? [],
      publisherId: input.publisherId,
      tarballPath: input.tarballPath,
    }) as unknown as IMarketplacePackage;
    return this.toPackageRecord(doc);
  }

  async findPackageById(packageId: string): Promise<PackageRecord | null> {
    const doc = await (MarketplacePackageModel.findOne({ packageId }) as unknown as {
      lean(): Promise<IMarketplacePackage | null>;
    }).lean();
    return doc ? this.toPackageRecord(doc) : null;
  }

  async listPackages(query: ListPackagesQuery): Promise<{ items: PackageRecord[]; total: number }> {
    const filter: Record<string, unknown> = {
      status: query.status ?? PackageStatus.APPROVED,
    };
    if (query.search) {
      filter["$or"] = [
        { name: { $regex: query.search, $options: "i" } },
        { description: { $regex: query.search, $options: "i" } },
        { tags: { $in: [new RegExp(query.search, "i")] } },
      ];
    }
    if (query.category) filter["category"] = query.category;

    const sortMap: Record<string, Record<string, number>> = {
      downloads: { downloads: -1 },
      rating:    { rating: -1 },
      newest:    { createdAt: -1 },
    };
    const sort = sortMap[query.sort ?? "newest"] ?? { createdAt: -1 };
    const limit  = query.limit  ?? 20;
    const offset = query.offset ?? 0;

    const [docs, total] = await Promise.all([
      (MarketplacePackageModel.find(filter).sort(sort).skip(offset).limit(limit) as unknown as {
        lean(): Promise<IMarketplacePackage[]>;
      }).lean(),
      MarketplacePackageModel.countDocuments(filter) as unknown as Promise<number>,
    ]);

    return { items: docs.map((d) => this.toPackageRecord(d)), total };
  }

  async updatePackageStatus(packageId: string, status: string): Promise<boolean> {
    const result = await MarketplacePackageModel.updateOne({ packageId }, { status });
    return result.modifiedCount > 0;
  }

  async incrementDownloads(packageId: string): Promise<void> {
    await MarketplacePackageModel.updateOne({ packageId }, { $inc: { downloads: 1 } });
  }

  // ── Installed nodes ─────────────────────────────────────────────────────────

  async installNode(tenantId: string, packageId: string, nodeType: string, version: string): Promise<InstalledNodeRecord> {
    // Upsert: update version if already installed
    const doc = await InstalledNodeModel.findOneAndUpdate(
      { tenantId, packageId },
      { $set: { nodeType, version, installedAt: new Date() } },
      { upsert: true, new: true }
    ) as unknown as IInstalledNode;
    return this.toInstalledRecord(doc);
  }

  async uninstallNode(tenantId: string, packageId: string): Promise<boolean> {
    const result = await InstalledNodeModel.deleteOne({ tenantId, packageId });
    return result.deletedCount > 0;
  }

  async listInstalledNodes(tenantId: string): Promise<InstalledNodeRecord[]> {
    const docs = await (InstalledNodeModel.find({ tenantId }) as unknown as {
      lean(): Promise<IInstalledNode[]>;
    }).lean();
    return docs.map((d) => this.toInstalledRecord(d));
  }

  async findInstalledNode(tenantId: string, packageId: string): Promise<InstalledNodeRecord | null> {
    const doc = await (InstalledNodeModel.findOne({ tenantId, packageId }) as unknown as {
      lean(): Promise<IInstalledNode | null>;
    }).lean();
    return doc ? this.toInstalledRecord(doc) : null;
  }

  async findAllInstalled(): Promise<InstalledNodeRecord[]> {
    const docs = await (InstalledNodeModel.find({}) as unknown as {
      lean(): Promise<IInstalledNode[]>;
    }).lean();
    return docs.map((d) => this.toInstalledRecord(d));
  }

  // ── Mappers ─────────────────────────────────────────────────────────────────

  private toPackageRecord(doc: IMarketplacePackage): PackageRecord {
    return {
      packageId:   doc.packageId,
      name:        doc.name,
      version:     doc.version,
      description: doc.description,
      author:      doc.author,
      nodeType:    doc.nodeType,
      category:    doc.category,
      tags:        doc.tags,
      permissions: doc.permissions,
      status:      doc.status,
      publisherId: doc.publisherId,
      tarballPath: doc.tarballPath,
      isBuiltIn:   doc.isBuiltIn ?? false,
      downloads:   doc.downloads,
      rating:      doc.rating,
      createdAt:   doc.createdAt,
      updatedAt:   doc.updatedAt,
    };
  }

  private toInstalledRecord(doc: IInstalledNode): InstalledNodeRecord {
    return {
      tenantId:    doc.tenantId,
      packageId:   doc.packageId,
      nodeType:    doc.nodeType,
      version:     doc.version,
      installedAt: doc.installedAt,
    };
  }
}
