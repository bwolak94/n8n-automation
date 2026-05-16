import {
  IntegrationTemplateModel,
  TemplateStatus,
  type IIntegrationTemplate,
  type TemplateWorkflow,
} from "./IntegrationTemplate.model.js";

// ─── Public record shape (lean) ───────────────────────────────────────────────

export interface TemplateRecord {
  templateId: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  author: string;
  authorId: string;
  isOfficial: boolean;
  status: string;
  workflow: TemplateWorkflow;
  requiredNodeTypes: string[];
  previewImageUrl?: string;
  repositoryUrl?: string;
  installCount: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Query / input types ──────────────────────────────────────────────────────

export interface ListTemplatesQuery {
  search?: string;
  category?: string;
  isOfficial?: boolean;
  sort?: "installs" | "rating" | "newest";
  limit?: number;
  offset?: number;
}

export interface CreateTemplateInput {
  templateId: string;
  name: string;
  description?: string;
  longDescription?: string;
  category: string;
  tags?: string[];
  author: string;
  authorId: string;
  isOfficial?: boolean;
  status?: string;
  workflow: TemplateWorkflow;
  requiredNodeTypes?: string[];
  previewImageUrl?: string;
  repositoryUrl?: string;
}

// ─── Lean doc helper ──────────────────────────────────────────────────────────

interface LeanTemplate {
  templateId: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  author: string;
  authorId: string;
  isOfficial: boolean;
  status: string;
  workflow: TemplateWorkflow;
  requiredNodeTypes: string[];
  previewImageUrl?: string;
  repositoryUrl?: string;
  installCount: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(doc: LeanTemplate): TemplateRecord {
  return {
    templateId:       doc.templateId,
    name:             doc.name,
    description:      doc.description,
    longDescription:  doc.longDescription,
    category:         doc.category,
    tags:             doc.tags ?? [],
    author:           doc.author,
    authorId:         doc.authorId,
    isOfficial:       doc.isOfficial,
    status:           doc.status,
    workflow:         doc.workflow,
    requiredNodeTypes: doc.requiredNodeTypes ?? [],
    previewImageUrl:  doc.previewImageUrl,
    repositoryUrl:    doc.repositoryUrl,
    installCount:     doc.installCount,
    rating:           doc.rating,
    ratingCount:      doc.ratingCount,
    createdAt:        doc.createdAt,
    updatedAt:        doc.updatedAt,
  };
}

// ─── IntegrationRepository ────────────────────────────────────────────────────

/* istanbul ignore next */
export class IntegrationRepository {
  // ── List approved templates (public catalog) ──────────────────────────────

  async listTemplates(
    query: ListTemplatesQuery = {}
  ): Promise<{ items: TemplateRecord[]; total: number }> {
    const filter: Record<string, unknown> = { status: TemplateStatus.APPROVED };

    if (query.search) {
      const regex = new RegExp(query.search, "i");
      filter["$or"] = [{ name: regex }, { description: regex }, { tags: regex }];
    }
    if (query.category) filter["category"] = query.category;
    if (query.isOfficial !== undefined) filter["isOfficial"] = query.isOfficial;

    const sortMap: Record<string, Record<string, number>> = {
      installs: { installCount: -1 },
      rating:   { rating: -1 },
      newest:   { createdAt: -1 },
    };
    const sort = sortMap[query.sort ?? "installs"] ?? sortMap["installs"];

    const limit  = query.limit  ?? 24;
    const offset = query.offset ?? 0;

    const [docs, total] = await Promise.all([
      (IntegrationTemplateModel
        .find(filter)
        .sort(sort)
        .skip(offset)
        .limit(limit) as unknown as { lean(): Promise<LeanTemplate[]> })
        .lean(),
      IntegrationTemplateModel.countDocuments(filter) as Promise<number>,
    ]);

    return { items: docs.map(toRecord), total };
  }

  // ── Find single template by ID ────────────────────────────────────────────

  async findById(templateId: string): Promise<TemplateRecord | null> {
    const doc = await (IntegrationTemplateModel
      .findOne({ templateId }) as unknown as { lean(): Promise<LeanTemplate | null> })
      .lean();
    return doc ? toRecord(doc) : null;
  }

  // ── Create / seed a template ──────────────────────────────────────────────

  async createTemplate(input: CreateTemplateInput): Promise<TemplateRecord> {
    const doc = await (IntegrationTemplateModel.create({
      ...input,
      status:       input.status ?? TemplateStatus.PENDING_REVIEW,
      installCount: 0,
      rating:       0,
      ratingCount:  0,
    }) as Promise<IIntegrationTemplate>);

    return toRecord(doc as unknown as LeanTemplate);
  }

  // ── Upsert — used by seed script (idempotent) ─────────────────────────────

  async upsertTemplate(input: CreateTemplateInput): Promise<void> {
    await IntegrationTemplateModel.findOneAndUpdate(
      { templateId: input.templateId },
      { $setOnInsert: { installCount: 0, rating: 0, ratingCount: 0 }, $set: input },
      { upsert: true }
    );
  }

  // ── Update status (admin approve/reject) ──────────────────────────────────

  async updateStatus(
    templateId: string,
    status: string
  ): Promise<boolean> {
    const result = await IntegrationTemplateModel.findOneAndUpdate(
      { templateId },
      { $set: { status } }
    );
    return result !== null;
  }

  // ── Increment install counter ─────────────────────────────────────────────

  async incrementInstalls(templateId: string): Promise<void> {
    await IntegrationTemplateModel.findOneAndUpdate(
      { templateId },
      { $inc: { installCount: 1 } }
    );
  }
}
