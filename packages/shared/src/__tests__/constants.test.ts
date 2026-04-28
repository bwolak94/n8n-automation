import { expectTypeOf } from "expect-type";
import {
  NodeCategory,
  WorkflowStatus,
  ExecutionStatus,
  Plan,
  TenantMemberRole,
  BackoffStrategy,
} from "../constants/index.js";
import type {
  NodeCategory as NodeCategoryType,
  WorkflowStatus as WorkflowStatusType,
  ExecutionStatus as ExecutionStatusType,
  Plan as PlanType,
} from "../constants/index.js";

describe("NodeCategory", () => {
  it("contains all expected categories", () => {
    const expected = [
      "triggers",
      "actions",
      "logic",
      "data",
      "ai",
      "communication",
      "integrations",
    ];
    expect(Object.values(NodeCategory)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(NodeCategory)).toHaveLength(expected.length);
  });

  it("inferred type is a union of string literals", () => {
    expectTypeOf<NodeCategoryType>().toMatchTypeOf<string>();
  });
});

describe("WorkflowStatus", () => {
  it("contains all expected statuses", () => {
    const expected = ["draft", "active", "inactive", "archived"];
    expect(Object.values(WorkflowStatus)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(WorkflowStatus)).toHaveLength(expected.length);
  });

  it("inferred type is a union of string literals", () => {
    expectTypeOf<WorkflowStatusType>().toMatchTypeOf<string>();
  });
});

describe("ExecutionStatus", () => {
  it("contains all expected statuses", () => {
    const expected = ["pending", "running", "success", "failed", "cancelled", "waiting"];
    expect(Object.values(ExecutionStatus)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(ExecutionStatus)).toHaveLength(expected.length);
  });

  it("inferred type is a union of string literals", () => {
    expectTypeOf<ExecutionStatusType>().toMatchTypeOf<string>();
  });
});

describe("Plan", () => {
  it("contains all expected plans", () => {
    const expected = ["free", "starter", "pro", "enterprise"];
    expect(Object.values(Plan)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(Plan)).toHaveLength(expected.length);
  });

  it("inferred type is a union of string literals", () => {
    expectTypeOf<PlanType>().toMatchTypeOf<string>();
  });
});

describe("TenantMemberRole", () => {
  it("contains all expected roles", () => {
    const expected = ["owner", "admin", "editor", "viewer"];
    expect(Object.values(TenantMemberRole)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(TenantMemberRole)).toHaveLength(expected.length);
  });
});

describe("BackoffStrategy", () => {
  it("contains all expected strategies", () => {
    const expected = ["exponential", "linear", "fixed"];
    expect(Object.values(BackoffStrategy)).toEqual(expect.arrayContaining(expected));
    expect(Object.values(BackoffStrategy)).toHaveLength(expected.length);
  });
});
