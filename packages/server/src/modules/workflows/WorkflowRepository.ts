import type mongoose from "mongoose";
import { WorkflowModel } from "./Workflow.model.js";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "../../engine/types.js";
import type { IWorkflowRepository } from "../../engine/types.js";

// ─── API-level types ──────────────────────────────────────────────────────────

export interface ApiWorkflowNode {
  id: string;
  type: string;
  category: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  retryPolicy?: unknown;
  loopNodeId?: string;
  loopGroup?: string;
}

export interface ApiWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface ApiWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  nodes: ApiWorkflowNode[];
  edges: ApiWorkflowEdge[];
  variables: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  status?: string;
  nodes?: ApiWorkflowNode[];
  edges?: ApiWorkflowEdge[];
  variables?: Record<string, unknown>;
  tags?: string[];
}

export interface PaginationOpts {
  limit: number;
  offset: number;
}

// ─── Lean doc type ────────────────────────────────────────────────────────────

interface WorkflowLeanDoc {
  _id: mongoose.Types.ObjectId | string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  nodes: ApiWorkflowNode[];
  edges: ApiWorkflowEdge[];
  variables: Record<string, unknown>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toApiWorkflow(doc: WorkflowLeanDoc): ApiWorkflow {
  return {
    id: String(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    nodes: doc.nodes ?? [],
    edges: doc.edges ?? [],
    variables: (doc.variables as Record<string, unknown>) ?? {},
    tags: doc.tags ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toWorkflowDefinition(doc: WorkflowLeanDoc): WorkflowDefinition {
  const nodes: WorkflowNode[] = (doc.nodes ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    config: n.config,
    ...(n.loopNodeId !== undefined ? { loopNodeId: n.loopNodeId } : {}),
  }));

  const edges: WorkflowEdge[] = (doc.edges ?? []).map((e) => ({
    from: e.source,
    to: e.target,
    ...(e.sourceHandle !== undefined ? { sourceHandle: e.sourceHandle } : {}),
  }));

  return {
    id: String(doc._id),
    tenantId: doc.tenantId,
    nodes,
    edges,
    variables: (doc.variables as Record<string, unknown>) ?? {},
  };
}

// ─── WorkflowRepository ───────────────────────────────────────────────────────

const NOT_DELETED = { $exists: false } as const;

export class WorkflowRepository implements IWorkflowRepository {
  // ── IWorkflowRepository (used by WorkflowRunner) ──────────────────────────

  async findById(
    workflowId: string,
    tenantId: string
  ): Promise<WorkflowDefinition | null> {
    const doc = await (WorkflowModel.findOne({
      _id: workflowId,
      tenantId,
      deletedAt: NOT_DELETED,
    }) as unknown as { lean(): Promise<WorkflowLeanDoc | null> }).lean();

    return doc ? toWorkflowDefinition(doc) : null;
  }

  // ── API methods ───────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    opts: PaginationOpts
  ): Promise<{ items: ApiWorkflow[]; total: number }> {
    const filter = { tenantId, deletedAt: NOT_DELETED };
    const [docs, total] = await Promise.all([
      (WorkflowModel.find(filter) as unknown as {
        skip(n: number): unknown;
        limit(n: number): unknown;
        lean(): Promise<WorkflowLeanDoc[]>;
      })
        .skip(opts.offset)
        .limit(opts.limit)
        .lean(),
      WorkflowModel.countDocuments(filter) as Promise<number>,
    ]);
    return { items: docs.map(toApiWorkflow), total };
  }

  async findByIdApi(
    id: string,
    tenantId: string
  ): Promise<ApiWorkflow | null> {
    const doc = await (WorkflowModel.findOne({
      _id: id,
      tenantId,
      deletedAt: NOT_DELETED,
    }) as unknown as { lean(): Promise<WorkflowLeanDoc | null> }).lean();

    return doc ? toApiWorkflow(doc) : null;
  }

  async create(tenantId: string, data: CreateWorkflowData): Promise<ApiWorkflow> {
    const doc = await (WorkflowModel.create({
      tenantId,
      ...data,
    }) as Promise<WorkflowLeanDoc>);
    return toApiWorkflow(doc);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<CreateWorkflowData>
  ): Promise<ApiWorkflow | null> {
    const doc = await (WorkflowModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: NOT_DELETED },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ) as unknown as { lean(): Promise<WorkflowLeanDoc | null> }).lean();

    return doc ? toApiWorkflow(doc) : null;
  }

  /** Used by WebhookController — no tenantId filter since the workflowId is the shared token. */
  async findByIdForWebhook(id: string): Promise<ApiWorkflow | null> {
    const doc = await (WorkflowModel.findOne({
      _id: id,
      deletedAt: NOT_DELETED,
    }) as unknown as { lean(): Promise<WorkflowLeanDoc | null> }).lean();

    return doc ? toApiWorkflow(doc) : null;
  }

  async softDelete(id: string, tenantId: string): Promise<boolean> {
    const result = await (WorkflowModel.findOneAndUpdate(
      { _id: id, tenantId, deletedAt: NOT_DELETED },
      { $set: { deletedAt: new Date() } }
    ) as Promise<WorkflowLeanDoc | null>);

    return result !== null;
  }
}
