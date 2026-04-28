import { z } from "zod";
import { Plan } from "../constants/index.js";

export const CheckoutSchema = z.object({
  plan: z.nativeEnum(Plan).refine((p) => p !== Plan.FREE, {
    message: "Cannot checkout a free plan",
  }),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const BillingPortalSchema = z.object({
  returnUrl: z.string().url(),
});

export const SubscriptionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  stripeSubscriptionId: z.string().min(1),
  stripeCustomerId: z.string().min(1),
  plan: z.nativeEnum(Plan),
  status: z.enum(["active", "canceled", "past_due", "trialing", "unpaid"]),
  currentPeriodStart: z.coerce.date(),
  currentPeriodEnd: z.coerce.date(),
  cancelAtPeriodEnd: z.boolean().default(false),
});
