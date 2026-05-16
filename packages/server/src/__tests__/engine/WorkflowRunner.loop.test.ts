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
    id: "exec-loop",
    workflowId: "wf-loop",
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

function makeRunner(wf: WorkflowDefinition, executor: NodeExecutor): WorkflowRunner {
  const log = makeLog();
  return new WorkflowRunner(
    makeWorkflowRepo(wf),
    makeExecutionLogRepo(log),
    executor,
    new TopologicalSorter(),
    new EventBus()
  );
}

// ─── Workflow factories ───────────────────────────────────────────────────────

/**
 * Root loopNode (no parent edges) → receives triggerData directly.
 * Inner: innerEmail (loopNodeId: "loop")
 * triggerData: { items: [...] }
 */
function makeRootLoopWorkflow(
  loopConfig: Record<string, unknown> = {}
): WorkflowDefinition {
  return {
    id: "wf-loop",
    tenantId: "t-1",
    nodes: [
      {
        id: "loop",
        type: "loop",
        config: { inputField: "items", batchSize: 1, collectResults: false, ...loopConfig },
      },
      { id: "innerEmail", type: "email", config: {}, loopNodeId: "loop" },
    ],
    edges: [], // no edges — loop is root, receives triggerData directly
    variables: {},
  };
}

/**
 * Root loopNode → inner chain: innerA → innerB
 */
function makeChainedInnerWorkflow(): WorkflowDefinition {
  return {
    id: "wf-chain",
    tenantId: "t-1",
    nodes: [
      { id: "loop",   type: "loop",      config: { inputField: "items", collectResults: true } },
      { id: "innerA", type: "transform", config: {}, loopNodeId: "loop" },
      { id: "innerB", type: "email",     config: {}, loopNodeId: "loop" },
    ],
    edges: [
      { from: "innerA", to: "innerB" },
    ],
    variables: {},
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowRunner loop execution", () => {
  let _eventBus: EventBus;

  beforeEach(() => {
    _eventBus = new EventBus();
  });

  // ── Basic iteration ────────────────────────────────────────────────────────

  describe("basic iteration", () => {
    it("executes inner node once per item", async () => {
      const wf = makeRootLoopWorkflow();
      const capturedItems: { nodeId: string; item: unknown; index: number }[] = [];
      const executor = {
        execute: jest.fn(
          async (node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) {
              capturedItems.push({ nodeId: node.id, item: ctx.$item.value, index: ctx.$item.index });
            }
            return { data: { sent: true } };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: ["a", "b", "c"] });

      expect(result.status).toBe("completed");
      expect(capturedItems).toHaveLength(3);
      expect(capturedItems[0]).toMatchObject({ nodeId: "innerEmail", item: "a", index: 0 });
      expect(capturedItems[1]).toMatchObject({ nodeId: "innerEmail", item: "b", index: 1 });
      expect(capturedItems[2]).toMatchObject({ nodeId: "innerEmail", item: "c", index: 2 });
    });

    it("empty array: loop outputs total=0 without calling inner executor", async () => {
      const wf = makeRootLoopWorkflow();
      let innerCallCount = 0;
      const executor = {
        execute: jest.fn(
          async (_node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) innerCallCount++;
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: [] });

      expect(result.status).toBe("completed");
      expect(innerCallCount).toBe(0);
      const loopOut = result.outputs["loop"]?.data as Record<string, unknown>;
      expect(loopOut["total"]).toBe(0);
      expect(loopOut["results"]).toEqual([]);
    });

    it("$item.index is injected sequentially", async () => {
      const wf = makeRootLoopWorkflow();
      const indices: number[] = [];
      const executor = {
        execute: jest.fn(
          async (_node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) indices.push(ctx.$item.index);
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-loop", "t-1", { items: ["x", "y", "z"] });

      expect(indices).toEqual([0, 1, 2]);
    });
  });

  // ── Batching ──────────────────────────────────────────────────────────────

  describe("batching", () => {
    it("batchSize=2: 3 items produce indices 0,1,2 (two batches: 2+1)", async () => {
      const wf = makeRootLoopWorkflow({ batchSize: 2 });
      const indices: number[] = [];
      const executor = {
        execute: jest.fn(
          async (_node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) indices.push(ctx.$item.index);
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-loop", "t-1", { items: [1, 2, 3] });

      expect(indices).toHaveLength(3);
      expect(indices.sort((a, b) => a - b)).toEqual([0, 1, 2]);
    });

    it("batchSize >= array length: all items processed", async () => {
      const wf = makeRootLoopWorkflow({ batchSize: 100 });
      let count = 0;
      const executor = {
        execute: jest.fn(
          async (_node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) count++;
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-loop", "t-1", { items: [1, 2, 3, 4, 5] });

      expect(count).toBe(5);
    });
  });

  // ── collectResults ────────────────────────────────────────────────────────

  describe("collectResults", () => {
    it("collects all item outputs in index order", async () => {
      const wf = makeRootLoopWorkflow({ collectResults: true });
      const executor = {
        execute: jest.fn(
          async (_node: WorkflowNode, _input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            return { data: { processed: ctx.$item?.value } };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: ["x", "y", "z"] });

      const loopData = result.outputs["loop"]?.data as Record<string, unknown>;
      const results = loopData["results"] as NodeOutput[];
      expect(results).toHaveLength(3);
      expect((results[0] as NodeOutput).data).toMatchObject({ processed: "x" });
      expect((results[1] as NodeOutput).data).toMatchObject({ processed: "y" });
      expect((results[2] as NodeOutput).data).toMatchObject({ processed: "z" });
      expect(loopData["total"]).toBe(3);
    });

    it("without collectResults: output has total and processed count only", async () => {
      const wf = makeRootLoopWorkflow({ collectResults: false });
      const executor = {
        execute: jest.fn(async (): Promise<NodeOutput> => ({ data: {} })),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: [1, 2, 3] });

      const loopData = result.outputs["loop"]?.data as Record<string, unknown>;
      expect(loopData["total"]).toBe(3);
      expect(loopData["processed"]).toBe(3);
      expect(loopData).not.toHaveProperty("results");
    });
  });

  // ── continueOnError ───────────────────────────────────────────────────────

  describe("continueOnError", () => {
    it("continueOnError=false: fails entire loop when one item fails", async () => {
      const wf = makeRootLoopWorkflow({ continueOnError: false });
      const executor = {
        execute: jest.fn(
          async (_n: WorkflowNode, _i: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item?.index === 1) throw new Error("Item 1 failed");
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: ["a", "b", "c"] });

      expect(result.status).toBe("failed");
    });

    it("continueOnError=true: processes other items when one fails", async () => {
      const wf = makeRootLoopWorkflow({ continueOnError: true, collectResults: true });
      const executor = {
        execute: jest.fn(
          async (_n: WorkflowNode, _i: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item?.index === 1) throw new Error("Item 1 failed");
            return { data: { ok: true } };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: ["a", "b", "c"] });

      expect(result.status).toBe("completed");
      const loopData = result.outputs["loop"]?.data as Record<string, unknown>;
      const results = loopData["results"] as NodeOutput[];
      // Items 0 and 2 succeeded; item 1 failed (null filtered out)
      expect(results).toHaveLength(2);
    });
  });

  // ── maxIterations ─────────────────────────────────────────────────────────

  describe("maxIterations", () => {
    it("throws LOOP_LIMIT_EXCEEDED when array length exceeds maxIterations", async () => {
      const wf = makeRootLoopWorkflow({ maxIterations: 3 });
      const executor = {
        execute: jest.fn(async (): Promise<NodeOutput> => ({ data: {} })),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: [1, 2, 3, 4] });

      expect(result.status).toBe("failed");
      expect(result.error?.message).toContain("maxIterations");
    });

    it("exactly maxIterations items: succeeds", async () => {
      const wf = makeRootLoopWorkflow({ maxIterations: 3 });
      const executor = {
        execute: jest.fn(async (): Promise<NodeOutput> => ({ data: {} })),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: [1, 2, 3] });

      expect(result.status).toBe("completed");
    });
  });

  // ── inputField resolution ─────────────────────────────────────────────────

  describe("inputField resolution", () => {
    it("resolves array from nested dot-path in triggerData", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-nested",
        tenantId: "t-1",
        nodes: [
          { id: "loop",      type: "loop",  config: { inputField: "payload.rows" } },
          { id: "innerNode", type: "email", config: {}, loopNodeId: "loop" },
        ],
        edges: [],
        variables: {},
      };
      let count = 0;
      const executor = {
        execute: jest.fn(
          async (_n: WorkflowNode, _i: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) count++;
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-nested", "t-1", {
        payload: { rows: ["r1", "r2"] },
      });

      expect(result.status).toBe("completed");
      expect(count).toBe(2);
    });

    it("resolves array from NodeOutput input (auto-unwraps .data)", async () => {
      // When loop has a parent node, input is a NodeOutput { data: { rows: [...] } }
      const wf: WorkflowDefinition = {
        id: "wf-from-node",
        tenantId: "t-1",
        nodes: [
          { id: "dbNode",    type: "database", config: {} },
          { id: "loop",      type: "loop",     config: { inputField: "rows" } },
          { id: "innerNode", type: "email",    config: {}, loopNodeId: "loop" },
        ],
        edges: [{ from: "dbNode", to: "loop" }],
        variables: {},
      };
      let innerCount = 0;
      const executor = {
        execute: jest.fn(
          async (node: WorkflowNode, _i: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (node.id === "dbNode") return { data: { rows: ["r1", "r2", "r3"] } };
            if (ctx.$item) innerCount++;
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-from-node", "t-1", {});

      expect(result.status).toBe("completed");
      expect(innerCount).toBe(3);
    });

    it("throws LOOP_INVALID_ARRAY when inputField resolves to non-array", async () => {
      const wf = makeRootLoopWorkflow({ inputField: "notAnArray" });
      const executor = {
        execute: jest.fn(async (): Promise<NodeOutput> => ({ data: {} })),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { notAnArray: "hello" });

      expect(result.status).toBe("failed");
      expect(result.error?.message).toContain("does not resolve to an array");
    });
  });

  // ── Chained inner nodes ───────────────────────────────────────────────────

  describe("chained inner nodes", () => {
    it("inner nodes execute in topological order per item", async () => {
      const wf = makeChainedInnerWorkflow();
      const callLog: string[] = [];
      const executor = {
        execute: jest.fn(
          async (node: WorkflowNode, _i: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (ctx.$item) callLog.push(`${node.id}@${ctx.$item.index}`);
            return { data: { from: node.id } };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-chain", "t-1", { items: ["a", "b"] });

      expect(callLog).toContain("innerA@0");
      expect(callLog).toContain("innerB@0");
      expect(callLog).toContain("innerA@1");
      expect(callLog).toContain("innerB@1");
      // innerA must come before innerB for each item
      expect(callLog.indexOf("innerA@0")).toBeLessThan(callLog.indexOf("innerB@0"));
      expect(callLog.indexOf("innerA@1")).toBeLessThan(callLog.indexOf("innerB@1"));
    });

    it("innerB receives innerA output as input", async () => {
      const wf = makeChainedInnerWorkflow();
      let innerBInput: unknown;
      const executor = {
        execute: jest.fn(
          async (node: WorkflowNode, input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (node.id === "innerB" && ctx.$item?.index === 0) {
              innerBInput = input;
            }
            return { data: { from: node.id } };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-chain", "t-1", { items: ["one"] });

      const inputData = (innerBInput as NodeOutput)?.data as Record<string, unknown>;
      expect(inputData).toMatchObject({ from: "innerA" });
    });
  });

  // ── Main chain continuity ────────────────────────────────────────────────

  describe("main chain continuity", () => {
    it("node after the loop receives loop NodeOutput as input", async () => {
      const wf: WorkflowDefinition = {
        id: "wf-post-loop",
        tenantId: "t-1",
        nodes: [
          { id: "loop",      type: "loop",  config: { inputField: "items", collectResults: true } },
          { id: "merge",     type: "merge", config: {} },
          { id: "innerNode", type: "email", config: {}, loopNodeId: "loop" },
        ],
        edges: [{ from: "loop", to: "merge" }],
        variables: {},
      };

      let mergeInput: unknown;
      const executor = {
        execute: jest.fn(
          async (node: WorkflowNode, input: unknown, ctx: ExpressionContext): Promise<NodeOutput> => {
            if (node.id === "merge") mergeInput = input;
            if (ctx.$item) return { data: { processed: ctx.$item.value } };
            return { data: {} };
          }
        ),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      await runner.run("wf-post-loop", "t-1", { items: ["a", "b"] });

      const mergeData = (mergeInput as NodeOutput)?.data as Record<string, unknown>;
      expect(mergeData).toHaveProperty("results");
      expect(mergeData).toHaveProperty("total", 2);
    });

    it("loop output is stored in workflow outputs keyed by loop node id", async () => {
      const wf = makeRootLoopWorkflow({ collectResults: true });
      const executor = {
        execute: jest.fn(async (): Promise<NodeOutput> => ({ data: { ok: true } })),
      } as unknown as NodeExecutor;
      const runner = makeRunner(wf, executor);

      const result = await runner.run("wf-loop", "t-1", { items: [1, 2] });

      expect(result.outputs).toHaveProperty("loop");
      const loopData = result.outputs["loop"]?.data as Record<string, unknown>;
      expect(loopData["total"]).toBe(2);
    });
  });
});
