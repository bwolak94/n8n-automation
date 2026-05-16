import type mongoose from "mongoose";
import { WorkflowVersionModel } from "./WorkflowVersion.model.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VersionSummary {
  id: string;
  workflowId: string;
  tenantId: string;
  version: number;
  label?: string;
  createdBy: string;
  createdAt: Date;
  autoSave: boolean;
}

export interface VersionDoc extends VersionSummary {
  snapshot: Record<string, unknown>;
}

interface VersionLean {
  _id: mongoose.Types.ObjectId | string;
  workflowId: string;
  tenantId: string;
  version: number;
  snapshot: Record<string, unknown>;
  label?: string;
  createdBy: string;
  createdAt: Date;
  autoSave: boolean;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toSummary(doc: VersionLean): VersionSummary {
  return {
    id: String(doc._id),
    workflowId: doc.workflowId,
    tenantId: doc.tenantId,
    version: doc.version,
    label: doc.label,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    autoSave: doc.autoSave,
  };
}

function toDoc(doc: VersionLean): VersionDoc {
  return { ...toSummary(doc), snapshot: doc.snapshot };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class WorkflowVersionRepository {
  async createVersion(
    workflowId: string,
    tenantId: string,
    snapshot: Record<string, unknown>,
    createdBy: string,
    opts: { label?: string; autoSave?: boolean } = {}
  ): Promise<VersionSummary> {
    const latest = await (WorkflowVersionModel.findOne({ workflowId }) as unknown as {
      sort(s: Record<string, number>): { lean(): Promise<VersionLean | null> };
    })
      .sort({ version: -1 })
      .lean();

    const nextVersion = latest ? latest.version + 1 : 1;

    const doc = await (WorkflowVersionModel.create({
      workflowId,
      tenantId,
      version: nextVersion,
      snapshot,
      createdBy,
      label: opts.label,
      autoSave: opts.autoSave ?? true,
    }) as Promise<VersionLean>);

    return toSummary(doc);
  }

  async listVersions(
    workflowId: string,
    tenantId: string,
    limit = 50
  ): Promise<VersionSummary[]> {
    const docs = await (WorkflowVersionModel.find(
      { workflowId, tenantId },
      { snapshot: 0 }
    ) as unknown as {
      sort(s: Record<string, number>): { limit(n: number): { lean(): Promise<VersionLean[]> } };
    })
      .sort({ version: -1 })
      .limit(limit)
      .lean();

    return docs.map(toSummary);
  }

  async getVersion(
    workflowId: string,
    tenantId: string,
    version: number
  ): Promise<VersionDoc | null> {
    const doc = await (WorkflowVersionModel.findOne({
      workflowId,
      tenantId,
      version,
    }) as unknown as { lean(): Promise<VersionLean | null> }).lean();

    return doc ? toDoc(doc) : null;
  }

  async tagVersion(
    workflowId: string,
    tenantId: string,
    version: number,
    label: string
  ): Promise<VersionSummary | null> {
    const doc = await (WorkflowVersionModel.findOneAndUpdate(
      { workflowId, tenantId, version },
      { $set: { label, autoSave: false } },
      { new: true, projection: { snapshot: 0 } }
    ) as unknown as { lean(): Promise<VersionLean | null> }).lean();

    return doc ? toSummary(doc) : null;
  }

  /**
   * Keep the latest `keepLatest` auto-save versions per workflow.
   * Labelled versions (autoSave: false) are never pruned.
   */
  async pruneOldAutoSaves(workflowId: string, keepLatest = 100): Promise<number> {
    // Find the version number threshold: the (keepLatest+1)th auto-save (oldest to keep boundary)
    const toKeep = await (WorkflowVersionModel.find(
      { workflowId, autoSave: true },
      { version: 1 }
    ) as unknown as {
      sort(s: Record<string, number>): { limit(n: number): { lean(): Promise<Array<{ version: number }>> } };
    })
      .sort({ version: -1 })
      .limit(keepLatest)
      .lean();

    if (toKeep.length < keepLatest) return 0;

    const minVersionToKeep = Math.min(...toKeep.map((d) => d.version));

    const result = await (WorkflowVersionModel.deleteMany({
      workflowId,
      autoSave: true,
      version: { $lt: minVersionToKeep },
    }) as Promise<{ deletedCount: number }>);

    return result.deletedCount;
  }
}
