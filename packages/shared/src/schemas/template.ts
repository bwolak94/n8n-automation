import { z } from "zod";
import { WorkflowNodeSchema, WorkflowEdgeSchema } from "./workflow.js";

export const TemplateCategory = {
  NOTIFICATIONS:     "Notifications",
  DATA_PROCESSING:   "Data Processing",
  CRM:               "CRM",
  DEVOPS:            "DevOps",
  FINANCE:           "Finance",
  AI:                "AI",
  UTILITIES:         "Utilities",
} as const;

export type TemplateCategory = (typeof TemplateCategory)[keyof typeof TemplateCategory];

export const TemplateCategoryValues = Object.values(TemplateCategory) as [string, ...string[]];

export const TemplateSchema = z.object({
  id:          z.string().min(1),
  name:        z.string().min(1).max(255),
  description: z.string().max(2000),
  category:    z.string().min(1),
  nodes:       z.array(WorkflowNodeSchema),
  edges:       z.array(WorkflowEdgeSchema),
  thumbnail:   z.string().optional(),
  author:      z.string().min(1),
  tags:        z.array(z.string()).default([]),
  usageCount:  z.number().int().min(0).default(0),
  rating:      z.number().min(0).max(5).default(0),
  isPublic:    z.boolean().default(true),
  tenantId:    z.string().nullable().default(null),
  createdAt:   z.coerce.date(),
  updatedAt:   z.coerce.date(),
});

export const TemplateSummarySchema = TemplateSchema.omit({ nodes: true, edges: true });

export const CreateTemplateSchema = z.object({
  name:        z.string().min(1).max(255),
  description: z.string().max(2000).default(""),
  category:    z.string().min(1),
  nodes:       z.array(WorkflowNodeSchema),
  edges:       z.array(WorkflowEdgeSchema),
  thumbnail:   z.string().optional(),
  tags:        z.array(z.string()).default([]),
  isPublic:    z.boolean().default(false),
});

export const TemplateListQuerySchema = z.object({
  search:   z.string().optional(),
  category: z.string().optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

export type Template            = z.infer<typeof TemplateSchema>;
export type TemplateSummary     = z.infer<typeof TemplateSummarySchema>;
export type CreateTemplate      = z.infer<typeof CreateTemplateSchema>;
export type TemplateListQuery   = z.infer<typeof TemplateListQuerySchema>;
