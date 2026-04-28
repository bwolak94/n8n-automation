import { AppError } from "./AppError.js";

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    public readonly errors?: ReadonlyArray<{ path: (string | number)[]; message: string }>
  ) {
    super(message, 400, "VALIDATION_ERROR");
  }
}
