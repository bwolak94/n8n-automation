import { NotFoundError } from "../../shared/errors/index.js";
import type { WorkflowVersionRepository, VersionSummary, VersionDoc } from "./WorkflowVersionRepository.js";
import type { WorkflowRepository, ApiWorkflow } from "./WorkflowRepository.js";

// ─── JSON Patch ───────────────────────────────────────────────────────────────

export interface JsonPatchOp {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

function computeJsonPatch(before: unknown, after: unknown, path = ""): JsonPatchOp[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];

  // Primitives or mismatched types
  if (
    typeof before !== "object" || before === null ||
    typeof after !== "object" || after === null ||
    Array.isArray(before) !== Array.isArray(after)
  ) {
    return path ? [{ op: "replace", path, value: after }] : [];
  }

  const ops: JsonPatchOp[] = [];

  if (Array.isArray(before) && Array.isArray(after)) {
    // Arrays: replace entire value — sufficient for node/edge change detection
    return path ? [{ op: "replace", path, value: after }] : [];
  }

  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;

  for (const key of Object.keys(a)) {
    const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
    const childPath = `${path}/${escaped}`;
    if (!(key in b)) {
      ops.push({ op: "add", path: childPath, value: a[key] });
    } else {
      ops.push(...computeJsonPatch(b[key], a[key], childPath));
    }
  }

  for (const key of Object.keys(b)) {
    if (!(key in a)) {
      const escaped = key.replace(/~/g, "~0").replace(/\//g, "~1");
      ops.push({ op: "remove", path: `${path}/${escaped}` });
    }
  }

  return ops;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class WorkflowVersionService {
  constructor(
    private readonly versionRepo: WorkflowVersionRepository,
    private readonly workflowRepo: WorkflowRepository
  ) {}

  async snapshotOnSave(
    workflowId: string,
    tenantId: string,
    snapshot: ApiWorkflow,
    userId: string,
    label?: string
  ): Promise<VersionSummary> {
    const version = await this.versionRepo.createVersion(
      workflowId,
      tenantId,
      snapshot as unknown as Record<string, unknown>,
      userId,
      { label, autoSave: !label }
    );

    await this.versionRepo.pruneOldAutoSaves(workflowId, 100);

    return version;
  }

  async listVersions(
    workflowId: string,
    tenantId: string,
    limit?: number
  ): Promise<VersionSummary[]> {
    return this.versionRepo.listVersions(workflowId, tenantId, limit);
  }

  async getVersion(
    workflowId: string,
    tenantId: string,
    version: number
  ): Promise<VersionDoc> {
    const doc = await this.versionRepo.getVersion(workflowId, tenantId, version);
    if (!doc) {
      throw new NotFoundError(`Version ${version} not found for workflow '${workflowId}'`);
    }
    return doc;
  }

  async restoreVersion(
    workflowId: string,
    tenantId: string,
    version: number,
    userId: string
  ): Promise<VersionSummary> {
    const versionDoc = await this.versionRepo.getVersion(workflowId, tenantId, version);
    if (!versionDoc) {
      throw new NotFoundError(`Version ${version} not found for workflow '${workflowId}'`);
    }

    // Restore the snapshot into the live workflow
    const { snapshot } = versionDoc;
    const updated = await this.workflowRepo.update(workflowId, tenantId, {
      name: snapshot["name"] as string,
      description: snapshot["description"] as string | undefined,
      status: snapshot["status"] as string,
      nodes: snapshot["nodes"] as ApiWorkflow["nodes"],
      edges: snapshot["edges"] as ApiWorkflow["edges"],
      tags: snapshot["tags"] as string[],
    });

    if (!updated) {
      throw new NotFoundError(`Workflow '${workflowId}' not found`);
    }

    // Create a new version from the restored snapshot (never mutate history)
    return this.snapshotOnSave(
      workflowId,
      tenantId,
      updated,
      userId,
      `Restored from v${version}`
    );
  }

  async tagVersion(
    workflowId: string,
    tenantId: string,
    version: number,
    label: string
  ): Promise<VersionSummary> {
    const tagged = await this.versionRepo.tagVersion(workflowId, tenantId, version, label);
    if (!tagged) {
      throw new NotFoundError(`Version ${version} not found for workflow '${workflowId}'`);
    }
    return tagged;
  }

  async compareVersions(
    workflowId: string,
    tenantId: string,
    v1: number,
    v2: number
  ): Promise<JsonPatchOp[]> {
    const [doc1, doc2] = await Promise.all([
      this.versionRepo.getVersion(workflowId, tenantId, v1),
      this.versionRepo.getVersion(workflowId, tenantId, v2),
    ]);

    if (!doc1) throw new NotFoundError(`Version ${v1} not found for workflow '${workflowId}'`);
    if (!doc2) throw new NotFoundError(`Version ${v2} not found for workflow '${workflowId}'`);

    return computeJsonPatch(doc1.snapshot, doc2.snapshot);
  }
}
