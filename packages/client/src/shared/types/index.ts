// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  tenantId: string;
  role: string;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export interface CanvasNodePosition {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  type: string;
  category: string;
  label: string;
  position: CanvasNodePosition;
  config: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkflowSummary {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  variables: Record<string, unknown>;
  tags: string[];
  schedule?: ScheduleConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  tenantId: string;
  status: string;
  steps: ExecutionStep[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

// ─── DLQ ──────────────────────────────────────────────────────────────────────

export interface DlqEntry {
  id: string;
  data: unknown;
  errorMessage: string;
  retryCount: number;
  failedAt: string;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  configSchema: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export interface CollaboratorUser {
  userId: string;
  email: string;
  color: string;
  cursor?: { x: number; y: number };
}

// ─── UI ───────────────────────────────────────────────────────────────────────

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}
