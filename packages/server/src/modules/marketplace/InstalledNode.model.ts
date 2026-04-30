import mongoose, { type Document, type Model } from "mongoose";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IInstalledNode extends Document {
  tenantId: string;
  packageId: string;
  nodeType: string;
  version: string;
  installedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = new mongoose.Schema<IInstalledNode>(
  {
    tenantId:    { type: String, required: true, index: true },
    packageId:   { type: String, required: true },
    nodeType:    { type: String, required: true },
    version:     { type: String, required: true },
    installedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

// Compound unique index: one installation record per tenant per package
schema.index({ tenantId: 1, packageId: 1 }, { unique: true });

export const InstalledNodeModel: Model<IInstalledNode> =
  mongoose.models["InstalledNode"] ??
  mongoose.model<IInstalledNode>("InstalledNode", schema);
