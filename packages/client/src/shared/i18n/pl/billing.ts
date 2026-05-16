import type { BillingMessages } from "../en/billing.js";

const billing: BillingMessages = {
  title: "Płatności",
  currentPlan: "Aktualny plan",
  upgrade: "Ulepsz plan",
  downgrade: "Obniż plan",
  plans: {
    free: "Darmowy",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  },
  invoices: "Faktury",
  paymentMethod: "Metoda płatności",
  nextBillingDate: "Następna data rozliczenia",
  cancelSubscription: "Anuluj subskrypcję",
  usageLimit: "Limit użycia",
  executionsUsed: "Użyte wykonania",
};

export { billing };
