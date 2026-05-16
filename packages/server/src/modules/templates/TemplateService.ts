import { NotFoundError, AppError } from "../../shared/errors/index.js";
import type {
  TemplateRepository,
  TemplateSummary,
  TemplateDoc,
  TemplateFilters,
  CreateTemplateData,
} from "./TemplateRepository.js";
import type { WorkflowService } from "../workflows/WorkflowService.js";
import type { ApiWorkflow } from "../workflows/WorkflowRepository.js";

export interface TemplateListResponse {
  items: TemplateSummary[];
  total: number;
  limit: number;
  offset: number;
}

export class TemplateService {
  constructor(
    private readonly repo: TemplateRepository,
    private readonly workflowService: WorkflowService
  ) {}

  async listTemplates(
    filters: TemplateFilters,
    tenantId: string,
    pagination: { limit: number; offset: number }
  ): Promise<TemplateListResponse> {
    const { items, total } = await this.repo.list(filters, tenantId, pagination);
    return { items, total, ...pagination };
  }

  async getTemplate(id: string): Promise<TemplateDoc> {
    const template = await this.repo.getById(id);
    if (!template) throw new NotFoundError(`Template '${id}' not found`);
    return template;
  }

  async cloneTemplate(
    templateId: string,
    tenantId: string,
    userId: string
  ): Promise<{ workflowId: string; name: string }> {
    const template = await this.repo.getById(templateId);
    if (!template) throw new NotFoundError(`Template '${templateId}' not found`);

    if (!template.isPublic && template.tenantId !== tenantId) {
      throw new AppError("Template not accessible", 403, "FORBIDDEN");
    }

    // Deep-copy nodes and edges; clear any credential references
    const nodes = template.nodes.map((node) => ({
      ...node,
      config: clearCredentialRefs(node.config),
    }));
    const edges = template.edges.map((edge) => ({ ...edge }));

    const workflow = await this.workflowService.create(tenantId, {
      name: `${template.name} (copy)`,
      description: template.description,
      nodes,
      edges,
      tags: template.tags,
    });

    // Increment usage atomically — fire-and-forget
    this.repo.incrementUsage(templateId).catch((err: unknown) =>
      console.error("[TemplateService] incrementUsage failed:", err)
    );

    return { workflowId: workflow.id, name: workflow.name };
  }

  async publishWorkflowAsTemplate(
    workflowId: string,
    tenantId: string,
    userId: string,
    meta: { category: string; tags?: string[]; isPublic?: boolean }
  ): Promise<TemplateDoc> {
    const workflow: ApiWorkflow = await this.workflowService.findById(workflowId, tenantId);

    const data: CreateTemplateData = {
      name:        workflow.name,
      description: workflow.description ?? "",
      category:    meta.category,
      nodes:       workflow.nodes.map((n) => ({ ...n, config: clearCredentialRefs(n.config) })),
      edges:       workflow.edges,
      author:      userId,
      tags:        meta.tags ?? workflow.tags ?? [],
      isPublic:    meta.isPublic ?? false,
      tenantId,
    };

    return this.repo.create(data);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively replaces $credentials.* references with an empty placeholder
 * so cloned workflows don't carry credential bindings from the template author.
 */
function clearCredentialRefs(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string" && value.startsWith("$credentials.")) {
      result[key] = "";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = clearCredentialRefs(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
