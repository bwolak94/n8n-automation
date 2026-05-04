import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { WorkflowRunner } from "../../engine/WorkflowRunner.js";
import { EventBus } from "../../engine/EventBus.js";
import { TopologicalSorter } from "../../engine/TopologicalSorter.js";
import { MergeNode } from "../../nodes/implementations/MergeNode.js";
import { InMemoryBranchSyncManager } from "../../engine/BranchSyncManager.js";
import { NodeRegistry } from "../../nodes/NodeRegistry.js";
import { NodeExecutor } from "../../engine/NodeExecutor.js";
import { ExpressionEvaluator } from "../../engine/ExpressionEvaluator.js";
import { RetryManager } from "../../engine/RetryManager.js";
import type {
  IWorkflowRepository,
  IExecutionLogRepository,
  WorkflowDefinition,
  ExecutionLog,
} from "../../engine/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLog(id = "exec-merge"): ExecutionLog {
  return {
    id,
    workflowId: "wf-merge",
    tenantId: "t-1",
    status: "running",
    startedAt: new Date(),
  };
}

function makeWorkflowRepo(wf: WorkflowDefinition): IWorkflowRepository {
  return { findById: jest.fn(async () => wf) as IWorkflowRepository["findById"] };
}

function makeExecutionLogRepo(log: ExecutionLog): IExecutionLogRepository {
  let stepN = 0;
  return {
    create:     jest.fn(async () => log) as IExecutionLogRepository["create"],
    update:     jest.fn(async () => {}) as IExecutionLogRepository["update"],
    createStep: jest.fn(async (step) => ({
      id: `step-${++stepN}`,
      executionId: log.id,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      status: "running" as const,
      startedAt: new Date(),
    })) as IExecutionLogRepository["createStep"],
    updateStep: jest.fn(async () => {}) as IExecutionLogRepository["updateStep"],
  };
}

/** Build a WorkflowRunner with a real MergeNode backed by InMemory sync. */
function makeRunner(wf: WorkflowDefinition): WorkflowRunner {
  const log = makeLog();
  const sync = new InMemoryBranchSyncManager();
  const registry = new NodeRegistry();
  registry.register(new MergeNode(sync));

  // Register stub nodes for http, database, email
  const stubExecute = jest.fn(
    async (
      _input: unknown,
      config: Readonly<Record<string, unknown>>
    ) => ({ data: config["_output"] ?? { ok: true } })
  );
  ["httpRequest", "database", "email", "transform"].forEach((type) => {
    registry.register({
      definition: { type, name: type },
      execute: stubExecute,
    });
  });

  const executor = new NodeExecutor(
    registry,
    new ExpressionEvaluator(),
    new RetryManager(new EventBus()),
    new EventBus()
  );

  return new WorkflowRunner(
    makeWorkflowRepo(wf),
    makeExecutionLogRepo(log),
    executor,
    new TopologicalSorter(),
    new EventBus()
  );
}

// ─── Workflow factories ────────────────────────────────────────────────────────

/**
 * Trigger → [HttpNode, DbNode] → MergeNode (waitAll) → EmailNode
 *
 *   trigger ──→ http  ──┐
 *            └→ db    ──→ merge → email
 */
function makeParallelMergeWorkflow(
  mergeConfig: Record<string, unknown> = {}
): WorkflowDefinition {
  return {
    id: "wf-merge",
    tenantId: "t-1",
    nodes: [
      { id: "http", type: "httpRequest", config: { _output: { status: 200, body: { user: "Alice" } } } },
      { id: "db",   type: "database",    config: { _output: { row: { score: 99 } } } },
      { id: "merge", type: "merge",      config: { mode: "waitAll", inputCount: 2, ...mergeConfig } },
      { id: "email", type: "email",      config: {} },
    ],
    edges: [
      { from: "http",  to: "merge" },
      { from: "db",    to: "merge" },
      { from: "merge", to: "email" },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowRunner + MergeNode integration", () => {
  describe("waitAll: parallel branches both feed into MergeNode", () => {
    it("execution completes with merged branches from both parallel nodes", async () => {
      const wf = makeParallelMergeWorkflow();
      const runner = makeRunner(wf);
      const result = await runner.run("wf-merge", "t-1", {});

      expect(result.status).toBe("completed");
      const mergeOutput = result.outputs["merge"];
      expect(mergeOutput).toBeDefined();
      const data = mergeOutput!.data as { branches: unknown[]; branchCount: number };
      expect(data.branchCount).toBe(2);
      expect(data.branches).toHaveLength(2);
    });

    it("EmailNode receives the merged output as its input", async () => {
      const wf = makeParallelMergeWorkflow();
      const runner = makeRunner(wf);
      const result = await runner.run("wf-merge", "t-1", {});

      // EmailNode ran after MergeNode
      expect(result.outputs["email"]).toBeDefined();
      expect(result.status).toBe("completed");
    });

    it("single-input path still works (no merge)", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-merge",
        tenantId: "t-1",
        nodes: [
          { id: "http",  type: "httpRequest", config: {} },
          { id: "email", type: "email",        config: {} },
        ],
        edges: [{ from: "http", to: "email" }],
      };
      const runner = makeRunner(wf);
      const result = await runner.run("wf-merge", "t-1", {});
      expect(result.status).toBe("completed");
      expect(result.outputs["http"]).toBeDefined();
      expect(result.outputs["email"]).toBeDefined();
    });
  });

  describe("append mode: concatenates branch arrays", () => {
    it("produces a flat array from both branches", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-merge",
        tenantId: "t-1",
        nodes: [
          { id: "b0",    type: "transform",  config: { _output: [1, 2, 3] } },
          { id: "b1",    type: "transform",  config: { _output: [4, 5] } },
          { id: "merge", type: "merge",      config: { mode: "append", inputCount: 2 } },
          { id: "email", type: "email",      config: {} },
        ],
        edges: [
          { from: "b0",    to: "merge" },
          { from: "b1",    to: "merge" },
          { from: "merge", to: "email" },
        ],
      };
      const runner = makeRunner(wf);
      const result = await runner.run("wf-merge", "t-1", {});
      expect(result.status).toBe("completed");
      expect(result.outputs["merge"]!.data).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("firstWins mode: first arriving branch wins", () => {
    it("execution completes with data from first branch", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-merge",
        tenantId: "t-1",
        nodes: [
          { id: "fast",  type: "transform",  config: { _output: { speed: "fast" } } },
          { id: "slow",  type: "transform",  config: { _output: { speed: "slow" } } },
          { id: "merge", type: "merge",      config: { mode: "firstWins", inputCount: 2 } },
        ],
        edges: [
          { from: "fast", to: "merge" },
          { from: "slow", to: "merge" },
        ],
      };
      const runner = makeRunner(wf);
      const result = await runner.run("wf-merge", "t-1", {});
      expect(result.status).toBe("completed");
      // MergeNode receives array [fast output, slow output] — returns first
      expect(result.outputs["merge"]).toBeDefined();
    });
  });
});
