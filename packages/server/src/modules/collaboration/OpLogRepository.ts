import type { CanvasOp } from "./CanvasOp.js";
import { CanvasOpModel, OpVersionModel } from "./OpLog.model.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpEntry {
  readonly version: number;
  readonly op: CanvasOp;
}

export interface OpState {
  readonly version: number;
  readonly ops: readonly OpEntry[];
}

export interface IOpLogRepository {
  append(
    workflowId: string,
    tenantId: string,
    userId: string,
    op: CanvasOp
  ): Promise<number>;
  getState(workflowId: string): Promise<OpState>;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class OpLogRepository implements IOpLogRepository {
  async append(
    workflowId: string,
    tenantId: string,
    userId: string,
    op: CanvasOp
  ): Promise<number> {
    // Atomically increment version counter — concurrent writes can't duplicate versions
    const versionDoc = await OpVersionModel.findOneAndUpdate(
      { workflowId },
      { $inc: { version: 1 } },
      { upsert: true, new: true }
    ).lean();

    const version = (versionDoc as { version: number }).version;

    await CanvasOpModel.create({ workflowId, tenantId, userId, version, op });

    return version;
  }

  async getState(workflowId: string): Promise<OpState> {
    const versionDoc = await OpVersionModel.findOne({ workflowId }).lean();
    const version = (versionDoc as { version: number } | null)?.version ?? 0;

    const rows = await CanvasOpModel.find({ workflowId })
      .sort({ version: -1 })
      .limit(50)
      .lean();

    const ops: OpEntry[] = rows.map((r) => ({
      version: r.version,
      op: r.op as CanvasOp,
    }));

    return { version, ops };
  }
}
