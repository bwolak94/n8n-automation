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

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  author: string;
  tags: string[];
  usageCount: number;
  rating: number;
  isPublic: boolean;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Template extends TemplateSummary {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

export interface ListTemplatesQuery {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export interface CloneTemplateResponse {
  workflowId: string;
  name: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listTemplates(
  query: ListTemplatesQuery = {}
): Promise<{ items: TemplateSummary[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (query.search)             params.set("search", query.search);
  if (query.category)           params.set("category", query.category);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  return apiClient.get(`templates${qs ? `?${qs}` : ""}`).json();
}

export async function getTemplate(id: string): Promise<Template> {
  return apiClient.get(`templates/${id}`).json();
}

export async function cloneTemplate(id: string): Promise<CloneTemplateResponse> {
  return apiClient.post(`templates/${id}/clone`).json();
}

export async function publishWorkflowAsTemplate(payload: {
  workflowId: string;
  category: string;
  tags?: string[];
  isPublic?: boolean;
}): Promise<Template> {
  return apiClient.post("templates", { json: payload }).json();
}
