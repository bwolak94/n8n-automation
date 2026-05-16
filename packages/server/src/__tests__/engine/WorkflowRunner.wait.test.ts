import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { WorkflowRunner } from "../../engine/WorkflowRunner.js";
import { EventBus } from "../../engine/EventBus.js";
import { TopologicalSorter } from "../../engine/TopologicalSorter.js";
import { makeSuspendOutput } from "../../engine/SuspendSignal.js";
import type { IResumableQueue } from "../../engine/WorkflowRunner.js";
import type { NodeExecutor } from "../../engine/NodeExecutor.js";
import type {
  IWorkflowRepository,
  IExecutionLogRepository,
  WorkflowDefinition,
  ExecutionLog,
  SuspendedExecutionState,
} from "../../engine/types.js";
import type { ExecutionContext, NodeOutput } from "../../nodes/contracts/INode.js";
import type { ExpressionContext, WorkflowNode } from "../../engine/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWorkflow(
  nodes: WorkflowDefinition["nodes"],
  edges: WorkflowDefinition["edges"] = []
): WorkflowDefinition {
  return { id: "wf-wait", tenantId: "t-1", nodes, edges };
}

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    id: "exec-wait",
    workflowId: "wf-wait",
    tenantId: "t-1",
    status: "running",
    startedAt: new Date(),
    ...overrides,
  };
}

function makeWorkflowRepo(wf: WorkflowDefinition | null = null): IWorkflowRepository {
  return { findById: jest.fn(async () => wf) as IWorkflowRepository["findById"] };
}

function makeExecutionLogRepo(
  log: ExecutionLog,
  suspendedState: SuspendedExecutionState | null = null
): IExecutionLogRepository & {
  suspend: jest.Mock;
  loadSuspendedState: jest.Mock;
} {
  let stepN = 0;
  const repo = {
    create:     jest.fn(async () => log) as IExecutionLogRepository["create"],
    update:     jest.fn(async () => {}) as IExecutionLogRepository["update"],
    createStep: jest.fn(async (step: { nodeId: string; nodeType: string }) => ({
      id: `step-${++stepN}`,
      executionId: log.id,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      status: "running" as const,
      startedAt: new Date(),
    })) as IExecutionLogRepository["createStep"],
    updateStep: jest.fn(async () => {}) as IExecutionLogRepository["updateStep"],
    suspend:    jest.fn(async () => {}),
    loadSuspendedState: jest.fn(async () => suspendedState),
  };
  return repo;
}

function makeQueue(): IResumableQueue & { enqueueResume: jest.Mock } {
  return { enqueueResume: jest.fn(async () => "job-1") };
}

type ExecutorFn = (
  node: WorkflowNode,
  _input: unknown,
  _exprCtx: ExpressionContext,
  _execCtx: ExecutionContext
) => Promise<NodeOutput>;

function makeExecutor(fn: ExecutorFn): NodeExecutor {
  return { execute: jest.fn(fn) as NodeExecutor["execute"] };
}

function makeNode(id: string, type = "noop"): WorkflowNode {
  return { id, type, config: {} };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WorkflowRunner — wait/suspend", () => {
  const eventBus = new EventBus();
  const sorter   = new TopologicalSorter();

  // ── Suspension ───────────────────────────────────────────────────────────────

  it("returns status='waiting' when a WaitNode fires", async () => {
    const log = makeLog();
    const wf  = makeWorkflow([makeNode("waitA", "wait")]);
    const repo = makeExecutionLogRepo(log);
    const queue = makeQueue();

    const executor = makeExecutor(async () =>
      makeSuspendOutput({ passed: true }, {
        delayMs: 5_000,
        resumeAfter: new Date(Date.now() + 5_000).toISOString(),
        mode: "duration",
      })
    );

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus, queue);
    const result = await runner.run("wf-wait", "t-1", {});

    expect(result.status).toBe("waiting");
  });

  it("calls executionLogRepo.suspend() with correct resumeAfter", async () => {
    const log = makeLog();
    const wf  = makeWorkflow([makeNode("waitA", "wait")]);
    const repo = makeExecutionLogRepo(log);
    const queue = makeQueue();
    const resumeAfter = new Date(Date.now() + 60_000).toISOString();

    const executor = makeExecutor(async () =>
      makeSuspendOutput({}, { delayMs: 60_000, resumeAfter, mode: "duration" })
    );

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus, queue);
    await runner.run("wf-wait", "t-1", {});

    expect(repo.suspend).toHaveBeenCalledWith(
      "exec-wait",
      new Date(resumeAfter),
      expect.objectContaining({ workflowId: "wf-wait" })
    );
  });

  it("enqueues a delayed BullMQ resume job with the correct delayMs", async () => {
    const log = makeLog();
    const wf  = makeWorkflow([makeNode("waitA", "wait")]);
    const repo = makeExecutionLogRepo(log);
    const queue = makeQueue();

    const executor = makeExecutor(async () =>
      makeSuspendOutput({}, { delayMs: 120_000, resumeAfter: new Date(Date.now() + 120_000).toISOString(), mode: "duration" })
    );

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus, queue);
    await runner.run("wf-wait", "t-1", {});

    expect(queue.enqueueResume).toHaveBeenCalledWith("exec-wait", "t-1", 120_000);
  });

  it("saves remaining groups in suspend state", async () => {
    const log = makeLog();
    // triggerNode → waitNode → afterNode (serial chain)
    const wf = makeWorkflow(
      [makeNode("triggerNode"), makeNode("waitNode", "wait"), makeNode("afterNode")],
      [{ from: "triggerNode", to: "waitNode" }, { from: "waitNode", to: "afterNode" }]
    );
    const repo = makeExecutionLogRepo(log);
    const queue = makeQueue();

    const executor = makeExecutor(async (node) => {
      if (node.type === "wait") {
        return makeSuspendOutput({}, { delayMs: 1_000, resumeAfter: new Date(Date.now() + 1_000).toISOString(), mode: "duration" });
      }
      return { data: { done: true } };
    });

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus, queue);
    await runner.run("wf-wait", "t-1", {});

    const suspendCall = repo.suspend.mock.calls[0] as [string, Date, SuspendedExecutionState];
    const state = suspendCall[2];
    // afterNode should be in remaining groups
    expect(state.remainingGroups.flat()).toContain("afterNode");
    // triggerNode and waitNode already ran
    expect(state.outputs).toHaveProperty("triggerNode");
  });

  it("does not enqueue if no queue is provided", async () => {
    const log = makeLog();
    const wf  = makeWorkflow([makeNode("waitA", "wait")]);
    const repo = makeExecutionLogRepo(log);

    const executor = makeExecutor(async () =>
      makeSuspendOutput({}, { delayMs: 5_000, resumeAfter: new Date(Date.now() + 5_000).toISOString(), mode: "duration" })
    );

    // No queue passed
    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus);
    const result = await runner.run("wf-wait", "t-1", {});
    expect(result.status).toBe("waiting");
    // suspend is still called
    expect(repo.suspend).toHaveBeenCalled();
  });

  // ── Resume ───────────────────────────────────────────────────────────────────

  it("resume() continues execution of remaining groups", async () => {
    const log = makeLog();
    const wf  = makeWorkflow(
      [makeNode("waitNode", "wait"), makeNode("afterNode")],
      [{ from: "waitNode", to: "afterNode" }]
    );

    const state: SuspendedExecutionState = {
      workflowId: "wf-wait",
      triggerData: {},
      outputs: { waitNode: { data: { original: true } } },
      remainingGroups: [["afterNode"]],
      activeBranches: [],
      skippedNodes: [],
    };

    const repo = makeExecutionLogRepo(log, state);
    const queue = makeQueue();
    const called: string[] = [];

    const executor = makeExecutor(async (node) => {
      called.push(node.id);
      return { data: { node: node.id } };
    });

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus, queue);
    const result = await runner.resume("exec-wait", "t-1");

    expect(called).toContain("afterNode");
    expect(result.status).toBe("completed");
  });

  it("resume() restores outputs from suspended state", async () => {
    const log = makeLog();
    const wf  = makeWorkflow(
      [makeNode("prev"), makeNode("afterNode")],
      [{ from: "prev", to: "afterNode" }]
    );

    const state: SuspendedExecutionState = {
      workflowId: "wf-wait",
      triggerData: {},
      outputs: { prev: { data: { x: 99 } } },
      remainingGroups: [["afterNode"]],
      activeBranches: [],
      skippedNodes: [],
    };

    const repo = makeExecutionLogRepo(log, state);
    const captured: { input: unknown }[] = [];

    const executor = makeExecutor(async (node, input) => {
      captured.push({ input });
      return { data: { ok: true } };
    });

    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, executor, sorter, eventBus);
    await runner.resume("exec-wait", "t-1");

    // afterNode should receive the prev node's output as input
    expect((captured[0]?.input as { data: { x: number } })?.data?.x).toBe(99);
  });

  it("resume() throws NotFoundError when no suspended state exists", async () => {
    const log = makeLog();
    const repo = makeExecutionLogRepo(log, null);
    const runner = new WorkflowRunner(makeWorkflowRepo(), repo, makeExecutor(async () => ({ data: null })), sorter, eventBus);

    await expect(runner.resume("exec-missing", "t-1")).rejects.toThrow("not found");
  });

  it("resume() marks execution as completed after all nodes run", async () => {
    const log = makeLog();
    const wf  = makeWorkflow([makeNode("lastNode")]);

    const state: SuspendedExecutionState = {
      workflowId: "wf-wait",
      triggerData: {},
      outputs: {},
      remainingGroups: [["lastNode"]],
      activeBranches: [],
      skippedNodes: [],
    };

    const repo = makeExecutionLogRepo(log, state);
    const runner = new WorkflowRunner(makeWorkflowRepo(wf), repo, makeExecutor(async () => ({ data: null })), sorter, eventBus);
    const result = await runner.resume("exec-wait", "t-1");

    expect(result.status).toBe("completed");
    expect(repo.update).toHaveBeenCalledWith("exec-wait", expect.objectContaining({ status: "running" }));
    expect(repo.update).toHaveBeenCalledWith("exec-wait", expect.objectContaining({ status: "completed" }));
  });
});
