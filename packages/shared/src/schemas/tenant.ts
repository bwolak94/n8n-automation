import { z } from "zod";
import { Plan, TenantMemberRole } from "../constants/index.js";

export const TenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  plan: z.nativeEnum(Plan),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  maxWorkflows: z.number().int().min(0),
  maxExecutionsPerMonth: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const TenantMemberSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(TenantMemberRole),
  joinedAt: z.coerce.date(),
});

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(TenantMemberRole).default(TenantMemberRole.EDITOR),
});

export const CreateTenantSchema = TenantSchema.omit({
  id: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  plan: z.nativeEnum(Plan).default(Plan.FREE),
  maxWorkflows: z.number().int().min(0).default(5),
  maxExecutionsPerMonth: z.number().int().min(0).default(100),
});
