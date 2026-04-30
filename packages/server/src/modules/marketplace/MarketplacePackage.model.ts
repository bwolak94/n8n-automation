import mongoose, { type Document, type Model } from "mongoose";

// ─── Status ───────────────────────────────────────────────────────────────────

export const PackageStatus = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type PackageStatus = (typeof PackageStatus)[keyof typeof PackageStatus];

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IMarketplacePackage extends Document {
  packageId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  nodeType: string;    // the unique INode.definition.type value
  category: string;
  tags: string[];
  permissions: string[];
  status: PackageStatus;
  publisherId: string;  // userId of the publisher
  tarballPath?: string; // relative path under uploads/marketplace/
  /** Ships with the server — no disk loading required to install */
  isBuiltIn: boolean;
  downloads: number;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = new mongoose.Schema<IMarketplacePackage>(
  {
    packageId:    { type: String, required: true, unique: true, index: true },
    name:         { type: String, required: true },
    version:      { type: String, required: true },
    description:  { type: String, default: "" },
    author:       { type: String, required: true },
    nodeType:     { type: String, required: true, unique: true, index: true },
    category:     { type: String, required: true, default: "integrations" },
    tags:         { type: [String], default: [] },
    permissions:  { type: [String], default: [] },
    status:       { type: String, enum: Object.values(PackageStatus), default: PackageStatus.PENDING_REVIEW },
    publisherId:  { type: String, required: true },
    tarballPath:  { type: String },
    isBuiltIn:    { type: Boolean, default: false },
    downloads:    { type: Number, default: 0 },
    rating:       { type: Number, default: 0 },
    ratingCount:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const MarketplacePackageModel: Model<IMarketplacePackage> =
  mongoose.models["MarketplacePackage"] ??
  mongoose.model<IMarketplacePackage>("MarketplacePackage", schema);
