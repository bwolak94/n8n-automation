export const NodeCategory = {
  TRIGGERS: "triggers",
  ACTIONS: "actions",
  LOGIC: "logic",
  DATA: "data",
  AI: "ai",
  COMMUNICATION: "communication",
  INTEGRATIONS: "integrations",
} as const;

export type NodeCategory = (typeof NodeCategory)[keyof typeof NodeCategory];

export const WorkflowStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const;

export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export const ExecutionStatus = {
  PENDING: "pending",
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  WAITING: "waiting",
} as const;

export type ExecutionStatus = (typeof ExecutionStatus)[keyof typeof ExecutionStatus];

export const Plan = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export type Plan = (typeof Plan)[keyof typeof Plan];

export const TenantMemberRole = {
  OWNER: "owner",
  ADMIN: "admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type TenantMemberRole = (typeof TenantMemberRole)[keyof typeof TenantMemberRole];

export const BackoffStrategy = {
  EXPONENTIAL: "exponential",
  LINEAR: "linear",
  FIXED: "fixed",
} as const;

export type BackoffStrategy = (typeof BackoffStrategy)[keyof typeof BackoffStrategy];
