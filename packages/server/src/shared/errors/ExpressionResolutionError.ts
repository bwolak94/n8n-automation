import { AppError } from "./AppError.js";

export class ExpressionResolutionError extends AppError {
  constructor(expression: string) {
    super(
      `Cannot resolve expression: '${expression}'`,
      400,
      "EXPRESSION_RESOLUTION_ERROR"
    );
  }
}
