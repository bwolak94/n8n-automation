import mongoose from "mongoose";
import { TemplateModel } from "./Template.model.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateNode {
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

export interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface TemplateDoc {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  thumbnail?: string;
  author: string;
  tags: string[];
  usageCount: number;
  rating: number;
  isPublic: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateSummary = Omit<TemplateDoc, "nodes" | "edges">;

export interface TemplateFilters {
  search?: string;
  category?: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  thumbnail?: string;
  author: string;
  tags?: string[];
  isPublic?: boolean;
  tenantId?: string | null;
}

// ─── Lean doc ────────────────────────────────────────────────────────────────

interface TemplateLeanDoc {
  _id: mongoose.Types.ObjectId | string;
  name: string;
  description: string;
  category: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  thumbnail?: string;
  author: string;
  tags: string[];
  usageCount: number;
  rating: number;
  isPublic: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toDoc(raw: TemplateLeanDoc): TemplateDoc {
  return {
    id:          String(raw._id),
    name:        raw.name,
    description: raw.description ?? "",
    category:    raw.category,
    nodes:       raw.nodes ?? [],
    edges:       raw.edges ?? [],
    thumbnail:   raw.thumbnail,
    author:      raw.author,
    tags:        raw.tags ?? [],
    usageCount:  raw.usageCount ?? 0,
    rating:      raw.rating ?? 0,
    isPublic:    raw.isPublic ?? true,
    tenantId:    raw.tenantId ?? null,
    createdAt:   raw.createdAt,
    updatedAt:   raw.updatedAt,
  };
}

function toSummary(raw: TemplateLeanDoc): TemplateSummary {
  const { nodes: _n, edges: _e, ...rest } = toDoc(raw);
  return rest;
}

// ─── TemplateRepository ───────────────────────────────────────────────────────

export class TemplateRepository {
  async list(
    filters: TemplateFilters,
    tenantId: string | null,
    pagination: { limit: number; offset: number }
  ): Promise<{ items: TemplateSummary[]; total: number }> {
    const query = this.buildFilter(filters, tenantId);

    const [docs, total] = await Promise.all([
      (TemplateModel.find(query) as unknown as {
        skip(n: number): unknown;
        limit(n: number): unknown;
        sort(s: Record<string, number>): unknown;
        lean(): Promise<TemplateLeanDoc[]>;
      })
        .sort({ usageCount: -1 })
        .skip(pagination.offset)
        .limit(pagination.limit)
        .lean(),
      TemplateModel.countDocuments(query) as Promise<number>,
    ]);

    return { items: docs.map(toSummary), total };
  }

  async getById(id: string): Promise<TemplateDoc | null> {
    const doc = await (TemplateModel.findById(id) as unknown as {
      lean(): Promise<TemplateLeanDoc | null>;
    }).lean();

    return doc ? toDoc(doc) : null;
  }

  async create(data: CreateTemplateData): Promise<TemplateDoc> {
    const doc = await (TemplateModel.create(data) as Promise<TemplateLeanDoc>);
    return toDoc(doc);
  }

  async incrementUsage(id: string): Promise<void> {
    await TemplateModel.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private buildFilter(
    filters: TemplateFilters,
    tenantId: string | null
  ): Record<string, unknown> {
    const query: Record<string, unknown> = {
      $or: [
        { isPublic: true, tenantId: null },
        ...(tenantId ? [{ tenantId }] : []),
      ],
    };

    if (filters.category) {
      query["category"] = filters.category;
    }

    if (filters.search) {
      const regex = new RegExp(filters.search, "i");
      query["$and"] = [
        {
          $or: [{ name: regex }, { description: regex }],
        },
      ];
    }

    return query;
  }
}
