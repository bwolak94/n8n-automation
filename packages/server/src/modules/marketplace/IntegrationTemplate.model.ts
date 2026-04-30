import mongoose, { type Document, type Model } from "mongoose";

// ─── Status ───────────────────────────────────────────────────────────────────

export const TemplateStatus = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type TemplateStatus = (typeof TemplateStatus)[keyof typeof TemplateStatus];

// ─── Sub-document interfaces ──────────────────────────────────────────────────

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

// ─── Document interface ───────────────────────────────────────────────────────

export interface IIntegrationTemplate extends Document {
  templateId: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  author: string;
  authorId: string;
  isOfficial: boolean;
  status: TemplateStatus;
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

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const templateNodeSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    type:     { type: String, required: true },
    category: { type: String, required: true },
    label:    { type: String, required: true },
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    config:   { type: Object, default: {} },
  },
  { _id: false }
);

const templateEdgeSchema = new mongoose.Schema(
  {
    id:           { type: String, required: true },
    source:       { type: String, required: true },
    target:       { type: String, required: true },
    sourceHandle: String,
    targetHandle: String,
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const schema = new mongoose.Schema<IIntegrationTemplate>(
  {
    templateId:        { type: String, required: true, unique: true, index: true },
    name:              { type: String, required: true },
    description:       { type: String, default: "" },
    longDescription:   { type: String },
    category:          { type: String, required: true, default: "integrations" },
    tags:              { type: [String], default: [] },
    author:            { type: String, required: true },
    authorId:          { type: String, required: true },
    isOfficial:        { type: Boolean, default: false },
    status:            {
      type:    String,
      enum:    Object.values(TemplateStatus),
      default: TemplateStatus.PENDING_REVIEW,
    },
    workflow: {
      nodes:     { type: [templateNodeSchema], default: [] },
      edges:     { type: [templateEdgeSchema], default: [] },
      variables: { type: Object, default: {} },
    },
    requiredNodeTypes: { type: [String], default: [] },
    previewImageUrl:   { type: String },
    repositoryUrl:     { type: String },
    installCount:      { type: Number, default: 0 },
    rating:            { type: Number, default: 0 },
    ratingCount:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ category: 1, status: 1 });
schema.index({ isOfficial: 1, status: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const IntegrationTemplateModel: Model<IIntegrationTemplate> =
  mongoose.models["IntegrationTemplate"] ??
  mongoose.model<IIntegrationTemplate>("IntegrationTemplate", schema);
