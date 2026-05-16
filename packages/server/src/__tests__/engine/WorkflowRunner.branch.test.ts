import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { WorkflowRunner } from "../../engine/WorkflowRunner.js";
import { EventBus } from "../../engine/EventBus.js";
import { TopologicalSorter } from "../../engine/TopologicalSorter.js";
import type { NodeExecutor } from "../../engine/NodeExecutor.js";
import type {
  IWorkflowRepository,
  IExecutionLogRepository,
  WorkflowDefinition,
  ExecutionLog,
} from "../../engine/types.js";
import type { ExecutionContext, NodeOutput } from "../../nodes/contracts/INode.js";
import type { ExpressionContext, WorkflowNode } from "../../engine/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    id: "exec-branch",
    workflowId: "wf-1",
    tenantId: "t-1",
    status: "running",
    startedAt: new Date(),
    ...overrides,
  };
}

function makeWorkflowRepo(wf: WorkflowDefinition): IWorkflowRepository {
  return { findById: jest.fn(async () => wf) as IWorkflowRepository["findById"] };
}

function makeExecutionLogRepo(log: ExecutionLog): IExecutionLogRepository {
  const stepCounter = { n: 0 };
  return {
    create: jest.fn(async () => log) as IExecutionLogRepository["create"],
    update: jest.fn(async () => {}) as IExecutionLogRepository["update"],
    createStep: jest.fn(async (step) => ({
      id: `step-${++stepCounter.n}`,
      executionId: log.id,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      status: "running" as const,
      startedAt: new Date(),
    })) as IExecutionLogRepository["createStep"],
    updateStep: jest.fn(async () => {}) as IExecutionLogRepository["updateStep"],
  };
}

/** An executor that records which nodeIds were actually called (non-skipped). */
function makeTrackingExecutor(
  outputs: Record<string, NodeOutput>
): { executor: NodeExecutor; called: string[] } {
  const called: string[] = [];
  const executor = {
    execute: jest.fn(
      async (
        node: WorkflowNode,
        _input: unknown,
        _exprCtx: ExpressionContext,
        _execCtx: ExecutionContext
      ): Promise<NodeOutput> => {
        called.push(node.id);
        return outputs[node.id] ?? { data: null };
      }
    ),
  } as unknown as NodeExecutor;
  return { executor, called };
}

function makeRunner(
  wf: WorkflowDefinition,
  executor: NodeExecutor
): WorkflowRunner {
  const log = makeLog();
  return new WorkflowRunner(
    makeWorkflowRepo(wf),
    makeExecutionLogRepo(log),
    executor,
    new TopologicalSorter(),
    new EventBus()
  );
}

// ─── Workflow topology helpers ────────────────────────────────────────────────

/**
 * trigger → conditional → [branch0: nodeA] [branch1: nodeB]
 *
 * Edges:
 *   trigger → conditional (no handle)
 *   conditional → nodeA (sourceHandle: "0")
 *   conditional → nodeB (sourceHandle: "1")
 */
function makeBinaryBranchWorkflow(): WorkflowDefinition {
  return {
    id: "wf-branch",
    tenantId: "t-1",
    nodes: [
      { id: "trigger",      type: "trigger",      config: {} },
      { id: "conditional",  type: "conditional",  config: {} },
      { id: "nodeA",        type: "email",         config: {} },
      { id: "nodeB",        type: "slack",         config: {} },
    ],
    edges: [
      { from: "trigger",     to: "conditional" },
      { from: "conditional", to: "nodeA", sourceHandle: "0" },
      { from: "conditional", to: "nodeB", sourceHandle: "1" },
    ],
    variables: {},
  };
}

/**
 * trigger → conditional → [branch0: nodeA] [branch1: nodeB] → merge
 *
 * merge depends on both nodeA and nodeB via separate edges.
 */
function makeBranchWithMergeWorkflow(): WorkflowDefinition {
  return {
    id: "wf-merge",
    tenantId: "t-1",
    nodes: [
      { id: "trigger",      type: "trigger",     config: {} },
      { id: "conditional",  type: "conditional", config: {} },
      { id: "nodeA",        type: "email",        config: {} },
      { id: "nodeB",        type: "slack",        config: {} },
      { id: "merge",        type: "merge",        config: {} },
    ],
    edges: [
      { from: "trigger",     to: "conditional" },
      { from: "conditional", to: "nodeA", sourceHandle: "0" },
      { from: "conditional", to: "nodeB", sourceHandle: "1" },
      { from: "nodeA",       to: "merge" },
      { from: "nodeB",       to: "merge" },
    ],
    variables: {},
  };
}

/**
 * trigger → conditional (switch, 3 branches)
 * → nodeA (sourceHandle: "0")
 * → nodeB (sourceHandle: "1")
 * → nodeC (sourceHandle: "2")
 */
function makeSwitchBranchWorkflow(): WorkflowDefinition {
  return {
    id: "wf-switch",
    tenantId: "t-1",
    nodes: [
      { id: "trigger",     type: "trigger",     config: {} },
      { id: "conditional", type: "conditional", config: {} },
      { id: "nodeA",       type: "email",        config: {} },
      { id: "nodeB",       type: "slack",        config: {} },
      { id: "nodeC",       type: "http",         config: {} },
    ],
    edges: [
      { from: "trigger",     to: "conditional" },
      { from: "conditional", to: "nodeA", sourceHandle: "0" },
      { from: "conditional", to: "nodeB", sourceHandle: "1" },
      { from: "conditional", to: "nodeC", sourceHandle: "2" },
    ],
    variables: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowRunner branch routing", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  // ── Binary (if/else) branching ─────────────────────────────────────────────

  describe("if/else binary branching", () => {
    it("executes branch 0 (true) and skips branch 1 when _branch=0", async () => {
      const wf = makeBinaryBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: { value: 10 } },
        conditional: { data: { _branch: 0, result: true } },
        nodeA:       { data: { sent: true } },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-branch", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("trigger");
      expect(called).toContain("conditional");
      expect(called).toContain("nodeA");
      expect(called).not.toContain("nodeB");
    });

    it("executes branch 1 (false) and skips branch 0 when _branch=1", async () => {
      const wf = makeBinaryBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: { value: 1 } },
        conditional: { data: { _branch: 1, result: false } },
        nodeB:       { data: { sent: true } },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-branch", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("trigger");
      expect(called).toContain("conditional");
      expect(called).toContain("nodeB");
      expect(called).not.toContain("nodeA");
    });

    it("_branch is stripped from stored output", async () => {
      const wf = makeBinaryBranchWorkflow();
      const { executor } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 0, result: true, extra: "keep-me" } },
        nodeA:       { data: "ok" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-branch", "t-1", {});

      const condOutput = result.outputs["conditional"]?.data as Record<string, unknown>;
      expect(condOutput).not.toHaveProperty("_branch");
      expect(condOutput).toHaveProperty("result", true);
      expect(condOutput).toHaveProperty("extra", "keep-me");
    });

    it("skipped node has no entry in outputs", async () => {
      const wf = makeBinaryBranchWorkflow();
      const { executor } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 0 } },
        nodeA:       { data: "ok" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-branch", "t-1", {});

      expect(result.outputs).not.toHaveProperty("nodeB");
      expect(result.outputs).toHaveProperty("nodeA");
    });
  });

  // ── Merge after branch ─────────────────────────────────────────────────────

  describe("merge after branching", () => {
    it("merge node runs when it has at least one active incoming edge", async () => {
      const wf = makeBranchWithMergeWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 0 } },
        nodeA:       { data: "from A" },
        // nodeB is skipped
        merge:       { data: "merged" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-merge", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("merge");
    });
  });

  // ── Switch (multi-branch) ──────────────────────────────────────────────────

  describe("switch multi-branch routing", () => {
    it("routes to branch 0 (only nodeA runs)", async () => {
      const wf = makeSwitchBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 0 } },
        nodeA:       { data: "A" },
      });

      const runner = makeRunner(wf, executor);
      await runner.run("wf-switch", "t-1", {});

      expect(called).toContain("nodeA");
      expect(called).not.toContain("nodeB");
      expect(called).not.toContain("nodeC");
    });

    it("routes to branch 1 (only nodeB runs)", async () => {
      const wf = makeSwitchBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 1 } },
        nodeB:       { data: "B" },
      });

      const runner = makeRunner(wf, executor);
      await runner.run("wf-switch", "t-1", {});

      expect(called).toContain("nodeB");
      expect(called).not.toContain("nodeA");
      expect(called).not.toContain("nodeC");
    });

    it("routes to branch 2 (only nodeC runs)", async () => {
      const wf = makeSwitchBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 2 } },
        nodeC:       { data: "C" },
      });

      const runner = makeRunner(wf, executor);
      await runner.run("wf-switch", "t-1", {});

      expect(called).toContain("nodeC");
      expect(called).not.toContain("nodeA");
      expect(called).not.toContain("nodeB");
    });

    it("out-of-range branch index: all downstream nodes are skipped", async () => {
      const wf = makeSwitchBranchWorkflow();
      const { executor, called } = makeTrackingExecutor({
        trigger:     { data: {} },
        conditional: { data: { _branch: 99 } },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-switch", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).not.toContain("nodeA");
      expect(called).not.toContain("nodeB");
      expect(called).not.toContain("nodeC");
    });
  });

  // ── Chained conditionals ───────────────────────────────────────────────────

  describe("chained conditionals", () => {
    /**
     * trigger → cond1 → [branch0: cond2 → nodeA | branch1: nodeB]
     *                       cond2 → [branch0: nodeA | branch1: nodeC]
     */
    it("second conditional in active branch executes correctly", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-chain",
        tenantId: "t-1",
        nodes: [
          { id: "trigger", type: "trigger",     config: {} },
          { id: "cond1",   type: "conditional", config: {} },
          { id: "cond2",   type: "conditional", config: {} },
          { id: "nodeA",   type: "email",        config: {} },
          { id: "nodeB",   type: "slack",        config: {} },
          { id: "nodeC",   type: "http",         config: {} },
        ],
        edges: [
          { from: "trigger", to: "cond1" },
          { from: "cond1",   to: "cond2", sourceHandle: "0" },
          { from: "cond1",   to: "nodeB", sourceHandle: "1" },
          { from: "cond2",   to: "nodeA", sourceHandle: "0" },
          { from: "cond2",   to: "nodeC", sourceHandle: "1" },
        ],
        variables: {},
      };

      // cond1 takes branch 0 → cond2 runs; cond2 takes branch 0 → nodeA runs
      const { executor, called } = makeTrackingExecutor({
        trigger: { data: {} },
        cond1:   { data: { _branch: 0 } },
        cond2:   { data: { _branch: 0 } },
        nodeA:   { data: "A" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-chain", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("cond2");
      expect(called).toContain("nodeA");
      expect(called).not.toContain("nodeB");
      expect(called).not.toContain("nodeC");
    });

    it("second conditional in INACTIVE branch is skipped entirely", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-chain2",
        tenantId: "t-1",
        nodes: [
          { id: "trigger", type: "trigger",     config: {} },
          { id: "cond1",   type: "conditional", config: {} },
          { id: "cond2",   type: "conditional", config: {} },
          { id: "nodeA",   type: "email",        config: {} },
          { id: "nodeB",   type: "slack",        config: {} },
          { id: "nodeC",   type: "http",         config: {} },
        ],
        edges: [
          { from: "trigger", to: "cond1" },
          { from: "cond1",   to: "cond2", sourceHandle: "0" },
          { from: "cond1",   to: "nodeB", sourceHandle: "1" },
          { from: "cond2",   to: "nodeA", sourceHandle: "0" },
          { from: "cond2",   to: "nodeC", sourceHandle: "1" },
        ],
        variables: {},
      };

      // cond1 takes branch 1 → nodeB runs, cond2 is skipped, nodeA/nodeC skipped
      const { executor, called } = makeTrackingExecutor({
        trigger: { data: {} },
        cond1:   { data: { _branch: 1 } },
        nodeB:   { data: "B" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-chain2", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("nodeB");
      expect(called).not.toContain("cond2");
      expect(called).not.toContain("nodeA");
      expect(called).not.toContain("nodeC");
    });
  });

  // ── Root nodes always run ──────────────────────────────────────────────────

  describe("root node (no incoming edges)", () => {
    it("trigger node with no incoming edges always executes", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-root",
        tenantId: "t-1",
        nodes: [{ id: "trigger", type: "trigger", config: {} }],
        edges: [],
        variables: {},
      };

      const { executor, called } = makeTrackingExecutor({
        trigger: { data: "triggered" },
      });

      const runner = makeRunner(wf, executor);
      const result = await runner.run("wf-root", "t-1", {});

      expect(result.status).toBe("completed");
      expect(called).toContain("trigger");
    });
  });

  // ── Input passed to active branch node ────────────────────────────────────

  describe("input routing", () => {
    it("active branch node receives the conditional node output as input", async () => {
      const wf = makeBinaryBranchWorkflow();
      const receivedInputs: Record<string, unknown> = {};

      const executor = {
        execute: jest.fn(
          async (
            node: WorkflowNode,
            input: unknown,
            _exprCtx: ExpressionContext,
            _execCtx: ExecutionContext
          ): Promise<NodeOutput> => {
            receivedInputs[node.id] = input;
            if (node.id === "conditional") return { data: { _branch: 0, result: true } };
            if (node.id === "trigger") return { data: { value: 42 } };
            return { data: "ok" };
          }
        ),
      } as unknown as NodeExecutor;

      const runner = makeRunner(wf, executor);
      await runner.run("wf-branch", "t-1", {});

      // nodeA's input is the NodeOutput of conditional (with _branch stripped)
      const nodeAInput = receivedInputs["nodeA"] as { data: Record<string, unknown> };
      expect(nodeAInput.data).toHaveProperty("result", true);
      expect(nodeAInput.data).not.toHaveProperty("_branch");
    });
  });
});
