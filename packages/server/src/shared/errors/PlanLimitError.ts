import { AppError } from "./AppError.js";

export class PlanLimitError extends AppError {
  constructor(message = "Plan limit exceeded") {
    super(message, 402, "PLAN_LIMIT_EXCEEDED");
  }
}
