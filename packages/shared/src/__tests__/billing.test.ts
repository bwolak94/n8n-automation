import { expectTypeOf } from "expect-type";
import { CheckoutSchema, BillingPortalSchema, SubscriptionSchema } from "../schemas/billing.js";
import { Plan } from "../constants/index.js";
import type { Checkout, Subscription } from "../types/index.js";

const validCheckout = {
  plan: Plan.PRO,
  successUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
};

const validSubscription = {
  id: "sub-1",
  tenantId: "tenant-1",
  stripeSubscriptionId: "sub_stripe_123",
  stripeCustomerId: "cus_stripe_123",
  plan: Plan.PRO,
  status: "active" as const,
  currentPeriodStart: new Date("2024-01-01"),
  currentPeriodEnd: new Date("2024-02-01"),
  cancelAtPeriodEnd: false,
};

describe("CheckoutSchema", () => {
  it("parses valid checkout", () => {
    expect(CheckoutSchema.safeParse(validCheckout).success).toBe(true);
  });

  it("rejects free plan checkout", () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, plan: Plan.FREE });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("plan");
  });

  it("rejects invalid successUrl", () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, successUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("successUrl");
  });

  it("rejects invalid cancelUrl", () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, cancelUrl: "not-a-url" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("cancelUrl");
  });

  it("accepts all paid plans", () => {
    const paidPlans = [Plan.STARTER, Plan.PRO, Plan.ENTERPRISE];
    for (const plan of paidPlans) {
      const result = CheckoutSchema.safeParse({ ...validCheckout, plan });
      expect(result.success).toBe(true);
    }
  });

  it("inferred Checkout type has correct shape", () => {
    expectTypeOf<Checkout>().toHaveProperty("plan");
    expectTypeOf<Checkout>().toHaveProperty("successUrl");
  });
});

describe("BillingPortalSchema", () => {
  it("parses valid billing portal request", () => {
    const result = BillingPortalSchema.safeParse({ returnUrl: "https://example.com/settings" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid returnUrl", () => {
    const result = BillingPortalSchema.safeParse({ returnUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("SubscriptionSchema", () => {
  it("parses valid subscription", () => {
    expect(SubscriptionSchema.safeParse(validSubscription).success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = SubscriptionSchema.safeParse({ ...validSubscription, status: "expired" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    const statuses = ["active", "canceled", "past_due", "trialing", "unpaid"] as const;
    for (const status of statuses) {
      const result = SubscriptionSchema.safeParse({ ...validSubscription, status });
      expect(result.success).toBe(true);
    }
  });

  it("inferred Subscription type has correct shape", () => {
    expectTypeOf<Subscription>().toHaveProperty("tenantId");
    expectTypeOf<Subscription>().toHaveProperty("plan");
    expectTypeOf<Subscription>().toHaveProperty("status");
  });
});
