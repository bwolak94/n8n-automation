import mongoose from "mongoose";

const workflowVersionSchema = new mongoose.Schema(
  {
    workflowId: { type: String, required: true },
    tenantId: { type: String, required: true },
    version: { type: Number, required: true },
    snapshot: { type: Object, required: true },
    label: String,
    createdBy: { type: String, required: true },
    autoSave: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workflowVersionSchema.index({ workflowId: 1, version: 1 }, { unique: true });
workflowVersionSchema.index({ workflowId: 1, tenantId: 1, version: -1 });

export const WorkflowVersionModel =
  (mongoose.models["WorkflowVersion"] as ReturnType<typeof mongoose.model>) ??
  mongoose.model("WorkflowVersion", workflowVersionSchema);
