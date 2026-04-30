import mongoose, { type Document, type Model } from "mongoose";
import { Plan } from "@automation-hub/shared";

// ─── Plan limits lookup ───────────────────────────────────────────────────────

export interface PlanLimits {
  readonly workflows: number;         // Infinity = unlimited
  readonly executionsPerMonth: number;
  readonly aiTokensPerMonth: number;
  readonly members: number;
  readonly customNodes: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  [Plan.FREE]: {
    workflows: 3,
    executionsPerMonth: 100,
    aiTokensPerMonth: 10_000,
    members: 1,
    customNodes: 0,
  },
  [Plan.STARTER]: {
    workflows: 10,
    executionsPerMonth: 1_000,
    aiTokensPerMonth: 100_000,
    members: 3,
    customNodes: 5,
  },
  [Plan.PRO]: {
    workflows: 25,
    executionsPerMonth: 5_000,
    aiTokensPerMonth: 500_000,
    members: 5,
    customNodes: 10,
  },
  [Plan.BUSINESS]: {
    workflows: Infinity,
    executionsPerMonth: 100_000,
    aiTokensPerMonth: 5_000_000,
    members: 25,
    customNodes: Infinity,
  },
  [Plan.ENTERPRISE]: {
    workflows: Infinity,
    executionsPerMonth: Infinity,
    aiTokensPerMonth: Infinity,
    members: Infinity,
    customNodes: Infinity,
  },
} as const;

// ─── Usage shape ──────────────────────────────────────────────────────────────

export interface UsageThisMonth {
  workflows: number;
  executions: number;
  aiTokens: number;
  members: number;
}

// ─── Mongoose document ────────────────────────────────────────────────────────

export interface ITenant extends Document {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  usageThisMonth: UsageThisMonth;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  usageResetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const usageSchema = new mongoose.Schema<UsageThisMonth>(
  {
    workflows: { type: Number, default: 0 },
    executions: { type: Number, default: 0 },
    aiTokens: { type: Number, default: 0 },
    members: { type: Number, default: 0 },
  },
  { _id: false }
);

const tenantSchema = new mongoose.Schema<ITenant>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[a-z0-9-]+$/,
    },
    plan: {
      type: String,
      enum: Object.values(Plan),
      required: true,
      default: Plan.FREE,
    },
    usageThisMonth: { type: usageSchema, default: () => ({}) },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    usageResetAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const TenantModel: Model<ITenant> =
  mongoose.models["Tenant"] ??
  mongoose.model<ITenant>("Tenant", tenantSchema);
