import { apiClient } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateNode {
  id: string;
  type: string;
  category: string;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
}

export interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface TemplateWorkflow {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  variables: Record<string, unknown>;
}

export interface IntegrationTemplate {
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
  createdAt: string;
  updatedAt: string;
}

export interface InstalledWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  nodes: TemplateNode[];
  edges: TemplateEdge[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListTemplatesQuery {
  search?: string;
  category?: string;
  isOfficial?: boolean;
  sort?: "installs" | "rating" | "newest";
  limit?: number;
  offset?: number;
}

export interface InstallTemplateInput {
  workflowName?: string;
  tags?: string[];
}

export interface PublishTemplateInput {
  name: string;
  description?: string;
  longDescription?: string;
  category: string;
  tags?: string[];
  workflowId: string;
  repositoryUrl?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listIntegrationTemplates(
  query: ListTemplatesQuery = {}
): Promise<{ items: IntegrationTemplate[]; total: number }> {
  const params = new URLSearchParams();
  if (query.search)                    params.set("search",     query.search);
  if (query.category)                  params.set("category",   query.category);
  if (query.isOfficial !== undefined)  params.set("isOfficial", String(query.isOfficial));
  if (query.sort)                      params.set("sort",       query.sort);
  if (query.limit !== undefined)       params.set("limit",      String(query.limit));
  if (query.offset !== undefined)      params.set("offset",     String(query.offset));
  const qs = params.toString();
  return apiClient.get(`marketplace/templates${qs ? `?${qs}` : ""}`).json();
}

export async function getIntegrationTemplate(templateId: string): Promise<IntegrationTemplate> {
  return apiClient.get(`marketplace/templates/${templateId}`).json();
}

export async function installIntegrationTemplate(
  templateId: string,
  data: InstallTemplateInput = {}
): Promise<InstalledWorkflow> {
  return apiClient.post(`marketplace/templates/${templateId}/install`, { json: data }).json();
}

export async function publishIntegrationTemplate(
  data: PublishTemplateInput
): Promise<IntegrationTemplate> {
  return apiClient.post("marketplace/templates", { json: data }).json();
}
