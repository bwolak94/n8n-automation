import { NotFoundError } from "../../shared/errors/index.js";
import type {
  ExecutionLogRepository,
  ApiExecution,
} from "./ExecutionLogRepository.js";

export interface PaginationOpts {
  limit: number;
  offset: number;
}

export class ExecutionService {
  constructor(private readonly repo: ExecutionLogRepository) {}

  async findById(id: string, tenantId: string): Promise<ApiExecution> {
    const exec = await this.repo.findById(id, tenantId);
    if (!exec) throw new NotFoundError(`Execution '${id}' not found`);
    return exec;
  }

  async findByWorkflowId(
    workflowId: string,
    tenantId: string,
    opts: PaginationOpts
  ): Promise<{ items: ApiExecution[]; total: number }> {
    return this.repo.findByWorkflowId(workflowId, tenantId, opts);
  }

  async cancel(id: string, tenantId: string): Promise<void> {
    const cancelled = await this.repo.cancel(id, tenantId);
    if (!cancelled) throw new NotFoundError(`Execution '${id}' not found or not cancellable`);
  }

  // Used by SSE stream — returns null if not found (no throw)
  async findByIdOrNull(
    id: string,
    tenantId: string
  ): Promise<ApiExecution | null> {
    return this.repo.findById(id, tenantId);
  }
}
