import { z } from "zod";
import { NodeCategory, WorkflowStatus } from "../constants/index.js";

// ─── Template workflow snapshot types ────────────────────────────────────────

export const TemplateNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  category: z.nativeEnum(NodeCategory),
  label: z.string().min(1).max(255),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()),
});

export const TemplateEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const TemplateWorkflowSchema = z.object({
  nodes: z.array(TemplateNodeSchema),
  edges: z.array(TemplateEdgeSchema),
  variables: z.record(z.unknown()).default({}),
});

// ─── Template status ──────────────────────────────────────────────────────────

export const TemplateStatus = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const TemplateStatusSchema = z.enum([
  TemplateStatus.PENDING_REVIEW,
  TemplateStatus.APPROVED,
  TemplateStatus.REJECTED,
]);

// ─── Integration template catalog item ───────────────────────────────────────

export const IntegrationTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  longDescription: z.string().max(10000).optional(),
  category: z.nativeEnum(NodeCategory),
  tags: z.array(z.string()).default([]),
  author: z.string().min(1).max(255),
  authorId: z.string().min(1),
  isOfficial: z.boolean().default(false),
  status: TemplateStatusSchema.default(TemplateStatus.PENDING_REVIEW),
  workflow: TemplateWorkflowSchema,
  requiredNodeTypes: z.array(z.string()).default([]),
  previewImageUrl: z.string().url().optional(),
  repositoryUrl: z.string().url().optional(),
  installCount: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type IntegrationTemplate = z.infer<typeof IntegrationTemplateSchema>;

// ─── Install template request ─────────────────────────────────────────────────

export const InstallTemplateSchema = z.object({
  /** Override the workflow name; defaults to the template name */
  workflowName: z.string().min(1).max(255).optional(),
  tags: z.array(z.string()).default([]),
});

export type InstallTemplateInput = z.infer<typeof InstallTemplateSchema>;

// ─── Publish community template request ──────────────────────────────────────

export const PublishTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  longDescription: z.string().max(10000).optional(),
  category: z.nativeEnum(NodeCategory),
  tags: z.array(z.string()).default([]),
  /** Pass the workflowId to publish an existing workflow as a template */
  workflowId: z.string().min(1),
  repositoryUrl: z.string().url().optional(),
});

export type PublishTemplateInput = z.infer<typeof PublishTemplateSchema>;

// ─── List templates query ─────────────────────────────────────────────────────

export const ListTemplatesQuerySchema = z.object({
  search: z.string().optional(),
  category: z.nativeEnum(NodeCategory).optional(),
  isOfficial: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  sort: z.enum(["installs", "rating", "newest"]).default("installs"),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListTemplatesQuery = z.infer<typeof ListTemplatesQuerySchema>;
