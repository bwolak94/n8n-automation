import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const nodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    label: { type: String, required: true },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    // Object (Mixed) — flexible config for any node type
    config: { type: Object, default: {} },
    retryPolicy: Object,
  },
  { _id: false }
);

const edgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: String,
    targetHandle: String,
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const workflowSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "draft",
    },
    nodes: { type: [nodeSchema], default: [] },
    edges: { type: [edgeSchema], default: [] },
    variables: { type: Object, default: {} },
    tags: { type: [String], default: [] },
    deletedAt: Date,
  },
  { timestamps: true }
);

workflowSchema.index({ tenantId: 1, deletedAt: 1 });

// ─── Model ────────────────────────────────────────────────────────────────────

export const WorkflowModel =
  (mongoose.models["Workflow"] as ReturnType<typeof mongoose.model>) ??
  mongoose.model("Workflow", workflowSchema);
