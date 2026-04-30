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

type DeepStringify<T> = T extends object ? { [K in keyof T]: DeepStringify<T[K]> } : string;
export type BillingMessages = DeepStringify<typeof billing>;
