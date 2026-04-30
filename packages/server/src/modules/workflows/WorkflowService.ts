import { NotFoundError, AppError } from "../../shared/errors/index.js";
import type {
  WorkflowRepository,
  ApiWorkflow,
  CreateWorkflowData,
  PaginationOpts,
} from "./WorkflowRepository.js";

export interface IEnqueueable {
  enqueue(
    workflowId: string,
    triggerData: Record<string, unknown>,
    tenantId: string
  ): Promise<string>;
}

export class WorkflowService {
  constructor(
    private readonly repo: WorkflowRepository,
    private readonly queue: IEnqueueable | null
  ) {}

  async findAll(
    tenantId: string,
    opts: PaginationOpts
  ): Promise<{ items: ApiWorkflow[]; total: number }> {
    return this.repo.findAll(tenantId, opts);
  }

  async findById(id: string, tenantId: string): Promise<ApiWorkflow> {
    const wf = await this.repo.findByIdApi(id, tenantId);
    if (!wf) throw new NotFoundError(`Workflow '${id}' not found`);
    return wf;
  }

  async create(tenantId: string, data: CreateWorkflowData): Promise<ApiWorkflow> {
    return this.repo.create(tenantId, data);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<CreateWorkflowData>
  ): Promise<ApiWorkflow> {
    const wf = await this.repo.update(id, tenantId, data);
    if (!wf) throw new NotFoundError(`Workflow '${id}' not found`);
    return wf;
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, tenantId);
    if (!deleted) throw new NotFoundError(`Workflow '${id}' not found`);
  }

  async execute(
    workflowId: string,
    tenantId: string,
    triggerData: Record<string, unknown>
  ): Promise<string> {
    if (!this.queue) {
      throw new AppError("Job queue is not available — Redis may not be running", 503, "QUEUE_UNAVAILABLE");
    }
    // Verify workflow exists and belongs to tenant
    const wf = await this.repo.findByIdApi(workflowId, tenantId);
    if (!wf) throw new NotFoundError(`Workflow '${workflowId}' not found`);

    try {
      return await this.queue.enqueue(workflowId, triggerData, tenantId);
    } catch (err) {
      console.error("[WorkflowService] enqueue failed:", err);
      throw new AppError("Failed to enqueue workflow — job queue unavailable", 503, "QUEUE_UNAVAILABLE");
    }
  }
}
