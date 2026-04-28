import { AppError } from "./AppError.js";

export class CyclicWorkflowError extends AppError {
  constructor() {
    super(
      "Workflow contains a cycle and cannot be executed",
      400,
      "CYCLIC_WORKFLOW"
    );
  }
}
