import { expectTypeOf } from "expect-type";
import {
  WorkflowSchema,
  RetryPolicySchema,
  WorkflowNodeSchema,
  WorkflowEdgeSchema,
  CreateWorkflowSchema,
} from "../schemas/workflow.js";
import { NodeCategory, WorkflowStatus, BackoffStrategy } from "../constants/index.js";
import type { Workflow, RetryPolicy } from "../types/index.js";

const validRetryPolicy = {
  maxAttempts: 3,
  backoffStrategy: BackoffStrategy.EXPONENTIAL,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
};

const validNode = {
  id: "node-1",
  type: "http-request",
  category: NodeCategory.ACTIONS,
  label: "Fetch Data",
  position: { x: 100, y: 200 },
  config: { url: "https://example.com" },
};

const validEdge = {
  id: "edge-1",
  source: "node-1",
  target: "node-2",
};

const validWorkflow = {
  id: "wf-1",
  tenantId: "tenant-1",
  name: "My Workflow",
  status: WorkflowStatus.DRAFT,
  nodes: [validNode],
  edges: [validEdge],
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("RetryPolicySchema", () => {
  it("parses valid retry policy", () => {
    const result = RetryPolicySchema.safeParse(validRetryPolicy);
    expect(result.success).toBe(true);
  });

  it("rejects maxAttempts < 1", () => {
    const result = RetryPolicySchema.safeParse({ ...validRetryPolicy, maxAttempts: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("maxAttempts");
  });

  it("rejects maxAttempts > 10", () => {
    const result = RetryPolicySchema.safeParse({ ...validRetryPolicy, maxAttempts: 11 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("maxAttempts");
  });

  it("accepts maxAttempts boundary value 1", () => {
    const result = RetryPolicySchema.safeParse({ ...validRetryPolicy, maxAttempts: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts maxAttempts boundary value 10", () => {
    const result = RetryPolicySchema.safeParse({ ...validRetryPolicy, maxAttempts: 10 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid backoff strategy", () => {
    const result = RetryPolicySchema.safeParse({
      ...validRetryPolicy,
      backoffStrategy: "invalid",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("backoffStrategy");
  });

  it("accepts all valid backoff strategies", () => {
    for (const strategy of Object.values(BackoffStrategy)) {
      const result = RetryPolicySchema.safeParse({
        ...validRetryPolicy,
        backoffStrategy: strategy,
      });
      expect(result.success).toBe(true);
    }
  });

  it("inferred type matches RetryPolicy", () => {
    expectTypeOf<RetryPolicy>().toHaveProperty("maxAttempts");
    expectTypeOf<RetryPolicy>().toHaveProperty("backoffStrategy");
  });
});

describe("WorkflowNodeSchema", () => {
  it("parses valid node", () => {
    expect(WorkflowNodeSchema.safeParse(validNode).success).toBe(true);
  });

  it("rejects empty id", () => {
    const result = WorkflowNodeSchema.safeParse({ ...validNode, id: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("id");
  });

  it("rejects invalid category", () => {
    const result = WorkflowNodeSchema.safeParse({ ...validNode, category: "invalid" });
    expect(result.success).toBe(false);
  });

  it("parses node with retryPolicy", () => {
    const result = WorkflowNodeSchema.safeParse({ ...validNode, retryPolicy: validRetryPolicy });
    expect(result.success).toBe(true);
  });
});

describe("WorkflowEdgeSchema", () => {
  it("parses valid edge", () => {
    expect(WorkflowEdgeSchema.safeParse(validEdge).success).toBe(true);
  });

  it("parses edge with optional handles", () => {
    const result = WorkflowEdgeSchema.safeParse({
      ...validEdge,
      sourceHandle: "output",
      targetHandle: "input",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty source", () => {
    const result = WorkflowEdgeSchema.safeParse({ ...validEdge, source: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("source");
  });
});

describe("WorkflowSchema", () => {
  it("parses valid workflow", () => {
    expect(WorkflowSchema.safeParse(validWorkflow).success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = WorkflowSchema.safeParse({ ...validWorkflow, name: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects name longer than 255 chars", () => {
    const result = WorkflowSchema.safeParse({ ...validWorkflow, name: "a".repeat(256) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("name");
  });

  it("rejects invalid status", () => {
    const result = WorkflowSchema.safeParse({ ...validWorkflow, status: "invalid" });
    expect(result.success).toBe(false);
  });

  it("coerces date strings", () => {
    const result = WorkflowSchema.safeParse({
      ...validWorkflow,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });

  it("inferred Workflow type has correct shape", () => {
    expectTypeOf<Workflow>().toHaveProperty("id");
    expectTypeOf<Workflow>().toHaveProperty("tenantId");
    expectTypeOf<Workflow>().toHaveProperty("nodes");
    expectTypeOf<Workflow>().toHaveProperty("edges");
  });
});

describe("CreateWorkflowSchema", () => {
  it("defaults status to draft", () => {
    const { id, tenantId, createdAt, updatedAt, ...rest } = validWorkflow;
    const result = CreateWorkflowSchema.safeParse({ ...rest, status: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe(WorkflowStatus.DRAFT);
    }
  });
});
