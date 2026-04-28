import type { z } from "zod";
import type {
  WorkflowSchema,
  WorkflowNodeSchema,
  WorkflowEdgeSchema,
  RetryPolicySchema,
  NodeConfigSchema,
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
} from "../schemas/workflow.js";
import type {
  ExecutionSchema,
  ExecutionStepSchema,
  TriggerExecutionSchema,
} from "../schemas/execution.js";
import type {
  TenantSchema,
  TenantMemberSchema,
  InviteMemberSchema,
  CreateTenantSchema,
} from "../schemas/tenant.js";
import type {
  MarketplacePackageSchema,
  InstalledNodeSchema,
  InstallNodeSchema,
} from "../schemas/marketplace.js";
import type {
  CanvasOpSchema,
  CanvasOpBatchSchema,
} from "../schemas/canvas.js";
import type {
  CheckoutSchema,
  BillingPortalSchema,
  SubscriptionSchema,
} from "../schemas/billing.js";
import type {
  ScheduleSchema,
  CreateScheduleSchema,
  UpdateScheduleSchema,
} from "../schemas/schedule.js";

// Workflow types
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
export type NodeConfig = z.infer<typeof NodeConfigSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;
export type CreateWorkflow = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof UpdateWorkflowSchema>;

// Execution types
export type Execution = z.infer<typeof ExecutionSchema>;
export type ExecutionStep = z.infer<typeof ExecutionStepSchema>;
export type TriggerExecution = z.infer<typeof TriggerExecutionSchema>;

// Tenant types
export type Tenant = z.infer<typeof TenantSchema>;
export type TenantMember = z.infer<typeof TenantMemberSchema>;
export type InviteMember = z.infer<typeof InviteMemberSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;

// Marketplace types
export type MarketplacePackage = z.infer<typeof MarketplacePackageSchema>;
export type InstalledNode = z.infer<typeof InstalledNodeSchema>;
export type InstallNode = z.infer<typeof InstallNodeSchema>;

// Canvas types
export type CanvasOp = z.infer<typeof CanvasOpSchema>;
export type CanvasOpBatch = z.infer<typeof CanvasOpBatchSchema>;

// Billing types
export type Checkout = z.infer<typeof CheckoutSchema>;
export type BillingPortal = z.infer<typeof BillingPortalSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;

// Schedule types
export type Schedule = z.infer<typeof ScheduleSchema>;
export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;
export type UpdateSchedule = z.infer<typeof UpdateScheduleSchema>;
