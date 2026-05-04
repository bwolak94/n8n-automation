import { AppError } from "./AppError.js";

export const MAX_SUB_WORKFLOW_DEPTH = 10;

export class SubWorkflowDepthError extends AppError {
  constructor(depth: number = MAX_SUB_WORKFLOW_DEPTH) {
    super(
      `Sub-workflow depth limit (${MAX_SUB_WORKFLOW_DEPTH}) exceeded at depth ${depth}`,
      400,
      "SUB_WORKFLOW_DEPTH_EXCEEDED"
    );
  }
}
