import { AppError } from "./AppError.js";

export class UnknownNodeTypeError extends AppError {
  constructor(type: string) {
    super(`Unknown node type: '${type}'`, 400, "UNKNOWN_NODE_TYPE");
  }
}
