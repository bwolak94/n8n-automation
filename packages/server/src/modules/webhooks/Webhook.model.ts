import mongoose, { type Document, type Model } from "mongoose";
import { WebhookMethod } from "@automation-hub/shared";

export interface IWebhook extends Document {
  tenantId: string;
  workflowId: string;
  webhookId: string; // UUID v4 — used in the public URL
  method: string;
  secret?: string;   // Optional HMAC secret stored in plaintext
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const webhookSchema = new mongoose.Schema<IWebhook>(
  {
    tenantId:   { type: String, required: true, index: true },
    workflowId: { type: String, required: true, index: true },
    webhookId:  { type: String, required: true, unique: true },
    method:     { type: String, enum: Object.values(WebhookMethod), default: "ANY" },
    secret:     { type: String },
    active:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WebhookModel: Model<IWebhook> =
  mongoose.models["Webhook"] ??
  mongoose.model<IWebhook>("Webhook", webhookSchema);
