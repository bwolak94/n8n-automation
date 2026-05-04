import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SubWorkflowNode } from "../../nodes/implementations/SubWorkflowNode.js";
import type { ISubWorkflowRunner } from "../../nodes/implementations/SubWorkflowNode.js";
import type { IWorkflowRepository, WorkflowDefinition, ExecutionResult } from "../../engine/types.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";
import { MAX_SUB_WORKFLOW_DEPTH } from "../../shared/errors/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWorkflow(id = "sub-wf-1", tenantId = "t-1"): WorkflowDefinition {
  return { id, tenantId, nodes: [], edges: [] };
}

function makeWorkflowRepo(wf: WorkflowDefinition | null = makeWorkflow()): IWorkflowRepository {
  return {
    findById: jest.fn(async () => wf) as IWorkflowRepository["findById"],
  };
}

function makeRunner(result: Partial<ExecutionResult> = {}): ISubWorkflowRunner {
  return {
    run: jest.fn(async () => ({
      executionId: "exec-sub",
      status: "completed" as const,
      outputs: { "nodeA": { data: { answer: 42 } } },
      ...result,
    })) as ISubWorkflowRunner["run"],
  };
}

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    tenantId: "t-1",
    executionId: "exec-parent",
    workflowId: "wf-parent",
    variables: {},
    depth: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subWorkflowId: "sub-wf-1",
    inputMapping: {},
    waitForResult: true,
    timeout: 30_000,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SubWorkflowNode", () => {
  let runner: ISubWorkflowRunner;
  let workflowRepo: IWorkflowRepository;
  let node: SubWorkflowNode;

  beforeEach(() => {
    runner = makeRunner();
    workflowRepo = makeWorkflowRepo();
    node = new SubWorkflowNode(runner, workflowRepo);
  });

  // ── Depth limit ─────────────────────────────────────────────────────────────

  it("throws SubWorkflowDepthError when depth equals MAX_SUB_WORKFLOW_DEPTH", async () => {
    const ctx = makeContext({ depth: MAX_SUB_WORKFLOW_DEPTH });
    await expect(node.execute({}, makeConfig(), ctx)).rejects.toThrow(
      `depth limit`
    );
  });

  it("throws SubWorkflowDepthError when depth exceeds MAX_SUB_WORKFLOW_DEPTH", async () => {
    const ctx = makeContext({ depth: MAX_SUB_WORKFLOW_DEPTH + 5 });
    await expect(node.execute({}, makeConfig(), ctx)).rejects.toThrow(
      `depth limit`
    );
  });

  it("does NOT throw at depth MAX_SUB_WORKFLOW_DEPTH - 1", async () => {
    const ctx = makeContext({ depth: MAX_SUB_WORKFLOW_DEPTH - 1 });
    const result = await node.execute({}, makeConfig(), ctx);
    expect(result.data).toBeDefined();
  });

  // ── Tenant isolation ────────────────────────────────────────────────────────

  it("throws ForbiddenError when sub-workflow is not found (wrong tenant)", async () => {
    workflowRepo = makeWorkflowRepo(null);
    node = new SubWorkflowNode(runner, workflowRepo);
    await expect(node.execute({}, makeConfig(), makeContext())).rejects.toThrow(
      "not found or belongs to a different tenant"
    );
  });

  it("looks up sub-workflow using the caller's tenantId", async () => {
    await node.execute({}, makeConfig(), makeContext({ tenantId: "tenant-abc" }));
    expect(workflowRepo.findById).toHaveBeenCalledWith("sub-wf-1", "tenant-abc");
  });

  // ── depth propagation ────────────────────────────────────────────────────────

  it("calls runner with depth + 1", async () => {
    await node.execute({}, makeConfig(), makeContext({ depth: 3 }));
    expect(runner.run).toHaveBeenCalledWith(
      "sub-wf-1",
      "t-1",
      expect.any(Object),
      expect.objectContaining({ depth: 4 })
    );
  });

  it("passes parentExecutionId from context", async () => {
    await node.execute({}, makeConfig(), makeContext({ executionId: "exec-parent-99" }));
    expect(runner.run).toHaveBeenCalledWith(
      "sub-wf-1",
      "t-1",
      expect.any(Object),
      expect.objectContaining({ parentExecutionId: "exec-parent-99" })
    );
  });

  // ── inputMapping ─────────────────────────────────────────────────────────────

  it("passes inputMapping fields as triggerData", async () => {
    const config = makeConfig({ inputMapping: { recipient: "alice@example.com", count: 5 } });
    await node.execute({}, config, makeContext());
    expect(runner.run).toHaveBeenCalledWith(
      "sub-wf-1",
      "t-1",
      expect.objectContaining({ recipient: "alice@example.com", count: 5 }),
      expect.any(Object)
    );
  });

  it("merges plain-object input with inputMapping (mapping wins)", async () => {
    const config = makeConfig({ inputMapping: { key: "override" } });
    await node.execute({ key: "original", other: "kept" }, config, makeContext());
    expect(runner.run).toHaveBeenCalledWith(
      "sub-wf-1",
      "t-1",
      expect.objectContaining({ key: "override", other: "kept" }),
      expect.any(Object)
    );
  });

  // ── Output passthrough ───────────────────────────────────────────────────────

  it("returns the last node output of the sub-workflow on success", async () => {
    runner = makeRunner({
      outputs: {
        nodeA: { data: { x: 1 } },
        nodeB: { data: { x: 99 } },
      },
    });
    node = new SubWorkflowNode(runner, workflowRepo);
    const result = await node.execute({}, makeConfig(), makeContext());
    expect((result.data as Record<string, unknown>)["x"]).toBe(99);
  });

  it("returns { data: null } when sub-workflow has no outputs", async () => {
    runner = makeRunner({ outputs: {} });
    node = new SubWorkflowNode(runner, workflowRepo);
    const result = await node.execute({}, makeConfig(), makeContext());
    expect(result.data).toBeNull();
  });

  // ── Error propagation ────────────────────────────────────────────────────────

  it("throws when sub-workflow status is failed and error is set", async () => {
    runner = makeRunner({ status: "failed", error: new Error("Sub failed") });
    node = new SubWorkflowNode(runner, workflowRepo);
    await expect(node.execute({}, makeConfig(), makeContext())).rejects.toThrow("Sub failed");
  });

  it("throws generic error when sub-workflow status is failed without error", async () => {
    runner = makeRunner({ status: "failed", error: undefined });
    node = new SubWorkflowNode(runner, workflowRepo);
    await expect(node.execute({}, makeConfig(), makeContext())).rejects.toThrow(
      "Sub-workflow execution failed"
    );
  });

  // ── Timeout ──────────────────────────────────────────────────────────────────

  it("times out if sub-workflow takes longer than configured timeout", async () => {
    // A never-resolving runner simulates a hung sub-workflow
    runner = {
      run: jest.fn(() => new Promise<ExecutionResult>(() => {})) as ISubWorkflowRunner["run"],
    };
    node = new SubWorkflowNode(runner, workflowRepo);
    const config = makeConfig({ timeout: 20 });
    await expect(node.execute({}, config, makeContext())).rejects.toThrow("timed out");
  });

  // ── waitForResult: false ─────────────────────────────────────────────────────

  it("returns { fired: true } immediately when waitForResult is false", async () => {
    const config = makeConfig({ waitForResult: false });
    const result = await node.execute({}, config, makeContext());
    expect(result.data).toMatchObject({ fired: true, subWorkflowId: "sub-wf-1" });
  });

  it("still calls runner.run when waitForResult is false", async () => {
    const config = makeConfig({ waitForResult: false });
    await node.execute({}, config, makeContext());
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  // ── depth defaults ───────────────────────────────────────────────────────────

  it("defaults depth to 0 when context.depth is undefined", async () => {
    const ctx = makeContext({ depth: undefined });
    await node.execute({}, makeConfig(), ctx);
    expect(runner.run).toHaveBeenCalledWith(
      "sub-wf-1",
      "t-1",
      expect.any(Object),
      expect.objectContaining({ depth: 1 })
    );
  });
});
