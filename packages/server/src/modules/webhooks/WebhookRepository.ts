import crypto from "crypto";
import { NotFoundError } from "../../shared/errors/index.js";
import { WebhookModel, type IWebhook } from "./Webhook.model.js";

export interface WebhookRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  webhookId: string;
  method: string;
  secret?: string;
  active: boolean;
  createdAt: Date;
}

export interface CreateWebhookInput {
  tenantId: string;
  workflowId: string;
  method: string;
  secret?: string;
}

function toRecord(doc: IWebhook): WebhookRecord {
  return {
    id: (doc._id as { toString(): string }).toString(),
    tenantId: doc.tenantId,
    workflowId: doc.workflowId,
    webhookId: doc.webhookId,
    method: doc.method,
    secret: doc.secret,
    active: doc.active,
    createdAt: doc.createdAt,
  };
}

export class WebhookRepository {
  async create(input: CreateWebhookInput): Promise<WebhookRecord> {
    const webhookId = crypto.randomUUID();
    const doc = await WebhookModel.create({ ...input, webhookId });
    return toRecord(doc);
  }

  async findByWebhookId(webhookId: string): Promise<WebhookRecord | null> {
    const doc = await WebhookModel.findOne({ webhookId }).lean();
    if (!doc) return null;
    return toRecord(doc as unknown as IWebhook);
  }

  async findByWorkflowId(workflowId: string, tenantId: string): Promise<WebhookRecord[]> {
    const docs = await WebhookModel.find({ workflowId, tenantId }).lean();
    return (docs as unknown as IWebhook[]).map(toRecord);
  }

  async findAllByTenant(tenantId: string): Promise<WebhookRecord[]> {
    const docs = await WebhookModel.find({ tenantId }).lean();
    return (docs as unknown as IWebhook[]).map(toRecord);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const result = await WebhookModel.deleteOne({ _id: id, tenantId });
    if (result.deletedCount === 0) {
      throw new NotFoundError(`Webhook '${id}' not found`);
    }
  }
}
