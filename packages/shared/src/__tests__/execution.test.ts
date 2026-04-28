import { expectTypeOf } from "expect-type";
import { ExecutionSchema, ExecutionStepSchema, TriggerExecutionSchema } from "../schemas/execution.js";
import { ExecutionStatus } from "../constants/index.js";
import type { Execution, ExecutionStep } from "../types/index.js";

const validStep = {
  id: "step-1",
  executionId: "exec-1",
  nodeId: "node-1",
  nodeType: "http-request",
  status: ExecutionStatus.SUCCESS,
  startedAt: new Date(),
  attemptNumber: 1,
};

const validExecution = {
  id: "exec-1",
  tenantId: "tenant-1",
  workflowId: "wf-1",
  status: ExecutionStatus.RUNNING,
  steps: [],
  startedAt: new Date(),
};

describe("ExecutionStepSchema", () => {
  it("parses valid step", () => {
    expect(ExecutionStepSchema.safeParse(validStep).success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = ExecutionStepSchema.safeParse({ ...validStep, status: "invalid" });
    expect(result.success).toBe(false);
  });

  it("parses step with optional fields", () => {
    const result = ExecutionStepSchema.safeParse({
      ...validStep,
      input: { foo: "bar" },
      output: { result: 42 },
      error: { message: "Something failed", code: "ERR_001" },
      finishedAt: new Date(),
      durationMs: 1500,
    });
    expect(result.success).toBe(true);
  });

  it("rejects attemptNumber < 1", () => {
    const result = ExecutionStepSchema.safeParse({ ...validStep, attemptNumber: 0 });
    expect(result.success).toBe(false);
  });

  it("inferred ExecutionStep type has correct shape", () => {
    expectTypeOf<ExecutionStep>().toHaveProperty("id");
    expectTypeOf<ExecutionStep>().toHaveProperty("status");
    expectTypeOf<ExecutionStep>().toHaveProperty("nodeId");
  });
});

describe("ExecutionSchema", () => {
  it("parses valid execution", () => {
    expect(ExecutionSchema.safeParse(validExecution).success).toBe(true);
  });

  it("defaults steps to empty array", () => {
    const { steps, ...rest } = validExecution;
    const result = ExecutionSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.steps).toEqual([]);
    }
  });

  it("rejects missing tenantId", () => {
    const { tenantId, ...rest } = validExecution;
    const result = ExecutionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("parses with nested steps", () => {
    const result = ExecutionSchema.safeParse({ ...validExecution, steps: [validStep] });
    expect(result.success).toBe(true);
  });

  it("inferred Execution type has correct shape", () => {
    expectTypeOf<Execution>().toHaveProperty("tenantId");
    expectTypeOf<Execution>().toHaveProperty("workflowId");
    expectTypeOf<Execution>().toHaveProperty("steps");
  });
});

describe("TriggerExecutionSchema", () => {
  it("parses valid trigger payload", () => {
    const result = TriggerExecutionSchema.safeParse({ workflowId: "wf-1" });
    expect(result.success).toBe(true);
  });

  it("accepts optional triggerData", () => {
    const result = TriggerExecutionSchema.safeParse({
      workflowId: "wf-1",
      triggerData: { event: "webhook", body: {} },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing workflowId", () => {
    const result = TriggerExecutionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
