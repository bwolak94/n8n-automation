import mongoose, { Schema, type Document } from "mongoose";
import type { CanvasOp } from "./CanvasOp.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ICanvasOp extends Document {
  workflowId: string;
  tenantId: string;
  userId: string;
  version: number;
  op: CanvasOp;
  createdAt: Date;
}

export interface IOpVersion extends Document {
  workflowId: string;
  version: number;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CanvasOpSchema = new Schema<ICanvasOp>(
  {
    workflowId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true },
    userId: { type: String, required: true },
    version: { type: Number, required: true },
    op: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "canvas_ops",
  }
);

CanvasOpSchema.index({ workflowId: 1, version: 1 }, { unique: true });

const OpVersionSchema = new Schema<IOpVersion>(
  {
    workflowId: { type: String, required: true, unique: true },
    version: { type: Number, default: 0 },
  },
  { collection: "canvas_op_versions" }
);

// ─── Models ───────────────────────────────────────────────────────────────────

export const CanvasOpModel =
  (mongoose.models["CanvasOp"] as mongoose.Model<ICanvasOp> | undefined) ??
  mongoose.model<ICanvasOp>("CanvasOp", CanvasOpSchema);

export const OpVersionModel =
  (mongoose.models["OpVersion"] as mongoose.Model<IOpVersion> | undefined) ??
  mongoose.model<IOpVersion>("OpVersion", OpVersionSchema);
