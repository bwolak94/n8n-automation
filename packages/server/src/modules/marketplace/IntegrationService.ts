import { randomUUID } from "node:crypto";
import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { TemplateStatus } from "./IntegrationTemplate.model.js";
import type {
  IntegrationRepository,
  TemplateRecord,
  ListTemplatesQuery,
} from "./IntegrationRepository.js";
import type {
  WorkflowRepository,
  ApiWorkflow,
} from "../workflows/WorkflowRepository.js";

// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface InstallTemplateData {
  workflowName?: string;
  tags?: string[];
}

export interface PublishTemplateData {
  name: string;
  description?: string;
  longDescription?: string;
  category: string;
  tags?: string[];
  workflowId: string;
  repositoryUrl?: string;
  tenantId: string;
  userId: string;
  userDisplayName: string;
}

export interface ListTemplatesResult {
  items: TemplateRecord[];
  total: number;
}

// ─── IntegrationService ───────────────────────────────────────────────────────

export class IntegrationService {
  constructor(
    private readonly integrationRepo: IntegrationRepository,
    private readonly workflowRepo: WorkflowRepository
  ) {}

  // ── List approved templates ────────────────────────────────────────────────

  async listTemplates(query: ListTemplatesQuery = {}): Promise<ListTemplatesResult> {
    return this.integrationRepo.listTemplates(query);
  }

  // ── Get template detail ────────────────────────────────────────────────────

  async getTemplate(templateId: string): Promise<TemplateRecord> {
    const template = await this.integrationRepo.findById(templateId);
    if (!template) throw new NotFoundError(`Integration template '${templateId}' not found`);
    if (template.status !== TemplateStatus.APPROVED) {
      throw new NotFoundError(`Integration template '${templateId}' not found`);
    }
    return template;
  }

  // ── Install: clone template workflow into tenant workspace ────────────────

  async installTemplate(
    tenantId: string,
    templateId: string,
    data: InstallTemplateData = {}
  ): Promise<ApiWorkflow> {
    const template = await this.integrationRepo.findById(templateId);
    if (!template) throw new NotFoundError(`Integration template '${templateId}' not found`);
    if (template.status !== TemplateStatus.APPROVED) {
      throw new ValidationError(`Template '${templateId}' is not approved for installation`);
    }

    // Clone the workflow definition into the tenant workspace
    const workflow = await this.workflowRepo.create(tenantId, {
      name:        data.workflowName ?? template.name,
      description: template.description,
      nodes:       template.workflow.nodes,
      edges:       template.workflow.edges,
      variables:   template.workflow.variables as Record<string, unknown>,
      tags:        [...(data.tags ?? []), ...(template.tags ?? []), "from-template"],
      status:      "draft",
    });

    await this.integrationRepo.incrementInstalls(templateId);

    return workflow;
  }

  // ── Publish community template from an existing tenant workflow ────────────

  async publishTemplate(data: PublishTemplateData): Promise<TemplateRecord> {
    const workflow = await this.workflowRepo.findByIdApi(data.workflowId, data.tenantId);
    if (!workflow) {
      throw new NotFoundError(`Workflow '${data.workflowId}' not found`);
    }

    // Derive required node types from the workflow
    const requiredNodeTypes = [...new Set(workflow.nodes.map((n) => n.type))];

    const templateId = randomUUID();

    return this.integrationRepo.createTemplate({
      templateId,
      name:              data.name,
      description:       data.description,
      longDescription:   data.longDescription,
      category:          data.category,
      tags:              data.tags ?? [],
      author:            data.userDisplayName,
      authorId:          data.userId,
      isOfficial:        false,
      status:            TemplateStatus.PENDING_REVIEW,
      workflow: {
        nodes:     workflow.nodes,
        edges:     workflow.edges,
        variables: workflow.variables,
      },
      requiredNodeTypes,
      repositoryUrl:     data.repositoryUrl,
    });
  }

  // ── Admin: approve / reject ────────────────────────────────────────────────

  async approveTemplate(templateId: string): Promise<void> {
    const ok = await this.integrationRepo.updateStatus(templateId, TemplateStatus.APPROVED);
    if (!ok) throw new NotFoundError(`Template '${templateId}' not found`);
  }

  async rejectTemplate(templateId: string): Promise<void> {
    const ok = await this.integrationRepo.updateStatus(templateId, TemplateStatus.REJECTED);
    if (!ok) throw new NotFoundError(`Template '${templateId}' not found`);
  }
}
