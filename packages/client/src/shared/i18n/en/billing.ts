export const billing = {
  title: "Billing",
  currentPlan: "Current plan",
  upgrade: "Upgrade plan",
  downgrade: "Downgrade plan",
  plans: {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  },
  invoices: "Invoices",
  paymentMethod: "Payment method",
  nextBillingDate: "Next billing date",
  cancelSubscription: "Cancel subscription",
  usageLimit: "Usage limit",
  executionsUsed: "Executions used",
} as const;

export type BillingMessages = typeof billing;
