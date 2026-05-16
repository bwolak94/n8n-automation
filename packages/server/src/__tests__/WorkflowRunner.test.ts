import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { WorkflowRunner } from "../engine/WorkflowRunner.js";
import { EventBus } from "../engine/EventBus.js";
import { TopologicalSorter } from "../engine/TopologicalSorter.js";
import type { NodeExecutor } from "../engine/NodeExecutor.js";
import type {
  IWorkflowRepository,
  IExecutionLogRepository,
  WorkflowDefinition,
  ExecutionLog,
} from "../engine/types.js";
import type { ExecutionContext, NodeOutput } from "../nodes/contracts/INode.js";
import type { ExpressionContext, WorkflowNode } from "../engine/types.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeWorkflow(
  overrides: Partial<WorkflowDefinition> = {}
): WorkflowDefinition {
  return {
    id: "wf-1",
    tenantId: "t-1",
    nodes: [{ id: "n1", type: "http", config: {} }],
    edges: [],
    variables: {},
    ...overrides,
  };
}

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    tenantId: "t-1",
    status: "running",
    startedAt: new Date(),
    ...overrides,
  };
}

function makeOutput(data: unknown = "result"): NodeOutput {
  return { data };
}

// ─── Mock factories ──────────────────────────────────────────────────────────

function makeWorkflowRepo(
  workflow: WorkflowDefinition | null
): IWorkflowRepository {
  return {
    findById: jest.fn(async () => workflow) as IWorkflowRepository["findById"],
  };
}

function makeExecutionLogRepo(log: ExecutionLog): IExecutionLogRepository {
  return {
    create: jest.fn(async () => log) as IExecutionLogRepository["create"],
    update: jest.fn(async () => {}) as IExecutionLogRepository["update"],
    createStep: jest.fn(async (_step) => ({
      id: "step-1",
      executionId: log.id,
      nodeId: "n1",
      nodeType: "http",
      status: "running" as const,
      startedAt: new Date(),
    })) as IExecutionLogRepository["createStep"],
    updateStep: jest.fn(async () => {}) as IExecutionLogRepository["updateStep"],
  };
}

function makeNodeExecutor(
  handler: (node: WorkflowNode) => Promise<NodeOutput>
): NodeExecutor {
  return {
    execute: jest.fn(
      async (
        node: WorkflowNode,
        _input: unknown,
        _exprCtx: ExpressionContext,
        _execCtx: ExecutionContext
      ) => handler(node)
    ),
  } as unknown as NodeExecutor;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("WorkflowRunner", () => {
  let eventBus: EventBus;
  let sorter: TopologicalSorter;

  beforeEach(() => {
    eventBus = new EventBus();
    sorter = new TopologicalSorter();
  });

  function makeRunner(
    workflow: WorkflowDefinition | null,
    log: ExecutionLog,
    executorHandler: (node: WorkflowNode) => Promise<NodeOutput>
  ): {
    runner: WorkflowRunner;
    logRepo: IExecutionLogRepository;
    executor: NodeExecutor;
  } {
    const workflowRepo = makeWorkflowRepo(workflow);
    const logRepo = makeExecutionLogRepo(log);
    const executor = makeNodeExecutor(executorHandler);
    const runner = new WorkflowRunner(
      workflowRepo,
      logRepo,
      executor,
      sorter,
      eventBus
    );
    return { runner, logRepo, executor };
  }

  // ── Correct execution order ─────────────────────────────────────────────

  describe("execution order", () => {
    it("executes a linear chain in dependency order", async () => {
      const order: string[] = [];
      const workflow = makeWorkflow({
        nodes: [
          { id: "a", type: "http", config: {} },
          { id: "b", type: "http", config: {} },
          { id: "c", type: "http", config: {} },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "c" },
        ],
      });

      const { runner } = makeRunner(workflow, makeLog(), async (node) => {
        order.push(node.id);
        return makeOutput(node.id);
      });

      const result = await runner.run("wf-1", "t-1", {});

      expect(order).toEqual(["a", "b", "c"]);
      expect(result.status).toBe("completed");
    });

    it("collects outputs by node ID", async () => {
      const workflow = makeWorkflow({
        nodes: [{ id: "n1", type: "http", config: {} }],
        edges: [],
      });

      const { runner } = makeRunner(workflow, makeLog(), async () =>
        makeOutput("output-value")
      );

      const result = await runner.run("wf-1", "t-1", {});

      expect(result.outputs["n1"]).toEqual({ data: "output-value" });
    });
  });

  // ── Parallel branches ───────────────────────────────────────────────────

  describe("parallel branches", () => {
    it("runs independent nodes in the same group and collects both outputs", async () => {
      const started: string[] = [];
      const workflow = makeWorkflow({
        nodes: [
          { id: "root", type: "http", config: {} },
          { id: "branch-a", type: "http", config: {} },
          { id: "branch-b", type: "http", config: {} },
        ],
        edges: [
          { from: "root", to: "branch-a" },
          { from: "root", to: "branch-b" },
        ],
      });

      const { runner } = makeRunner(workflow, makeLog(), async (node) => {
        started.push(node.id);
        return makeOutput(node.id);
      });

      const result = await runner.run("wf-1", "t-1", {});

      expect(result.status).toBe("completed");
      expect(result.outputs["branch-a"]).toEqual({ data: "branch-a" });
      expect(result.outputs["branch-b"]).toEqual({ data: "branch-b" });
    });
  });

  // ── Failed node halts group ─────────────────────────────────────────────

  describe("failed node", () => {
    it("returns failed status when a node throws", async () => {
      const workflow = makeWorkflow({
        nodes: [{ id: "bad", type: "http", config: {} }],
        edges: [],
      });

      const { runner, logRepo } = makeRunner(
        workflow,
        makeLog(),
        async () => {
          throw new Error("node exploded");
        }
      );

      const result = await runner.run("wf-1", "t-1", {});

      expect(result.status).toBe("failed");
      expect(result.error?.message).toBe("node exploded");
      expect(logRepo.update).toHaveBeenCalledWith(
        "exec-1",
        expect.objectContaining({ status: "failed" })
      );
    });

    it("does not execute subsequent groups after a group failure", async () => {
      const executed: string[] = [];
      const workflow = makeWorkflow({
        nodes: [
          { id: "first", type: "http", config: {} },
          { id: "second", type: "http", config: {} },
        ],
        edges: [{ from: "first", to: "second" }],
      });

      const { runner } = makeRunner(workflow, makeLog(), async (node) => {
        executed.push(node.id);
        if (node.id === "first") throw new Error("fail");
        return makeOutput("ok");
      });

      await runner.run("wf-1", "t-1", {});

      expect(executed).toEqual(["first"]);
      expect(executed).not.toContain("second");
    });
  });

  // ── EventBus event ordering ─────────────────────────────────────────────

  describe("EventBus events", () => {
    it("emits execution.started then execution.completed on success", async () => {
      const emitted: string[] = [];
      eventBus.on("execution.started", () => { emitted.push("execution.started"); });
      eventBus.on("execution.completed", () => { emitted.push("execution.completed"); });

      const workflow = makeWorkflow();
      const { runner } = makeRunner(workflow, makeLog(), async () => makeOutput());

      await runner.run("wf-1", "t-1", {});

      expect(emitted).toEqual(["execution.started", "execution.completed"]);
    });

    it("emits execution.started then execution.failed on error", async () => {
      const emitted: string[] = [];
      eventBus.on("execution.started", () => { emitted.push("execution.started"); });
      eventBus.on("execution.failed", () => { emitted.push("execution.failed"); });

      const workflow = makeWorkflow();
      const { runner } = makeRunner(workflow, makeLog(), async () => {
        throw new Error("boom");
      });

      await runner.run("wf-1", "t-1", {});

      expect(emitted).toEqual(["execution.started", "execution.failed"]);
    });

    it("includes correct executionId in events", async () => {
      const log = makeLog({ id: "exec-42" });
      const capturedIds: string[] = [];

      eventBus.on("execution.started", (e) => capturedIds.push(e.executionId));
      eventBus.on("execution.completed", (e) => capturedIds.push(e.executionId));

      const workflow = makeWorkflow();
      const { runner } = makeRunner(workflow, log, async () => makeOutput());

      await runner.run("wf-1", "t-1", {});

      expect(capturedIds).toEqual(["exec-42", "exec-42"]);
    });
  });

  // ── variables undefined fallback ──────────────────────────────────────

  describe("workflow variables", () => {
    it("handles workflow with no variables defined", async () => {
      const workflow: WorkflowDefinition = {
        id: "wf-1",
        tenantId: "t-1",
        nodes: [{ id: "n1", type: "http", config: {} }],
        edges: [],
        // variables deliberately omitted
      };

      const { runner } = makeRunner(workflow, makeLog(), async () => makeOutput());

      const result = await runner.run("wf-1", "t-1", {});

      expect(result.status).toBe("completed");
    });
  });

  // ── Non-Error rejection ────────────────────────────────────────────────

  describe("non-Error rejection", () => {
    it("wraps non-Error rejection in an Error", async () => {
      const workflow = makeWorkflow({
        nodes: [{ id: "n1", type: "http", config: {} }],
        edges: [],
      });

      const executor: NodeExecutor = {
        execute: jest.fn(async () => {
          return Promise.reject("raw string rejection");
        }),
      } as unknown as NodeExecutor;

      const logRepo = makeExecutionLogRepo(makeLog());
      const runner = new WorkflowRunner(
        makeWorkflowRepo(workflow),
        logRepo,
        executor,
        sorter,
        eventBus
      );

      const result = await runner.run("wf-1", "t-1", {});

      expect(result.status).toBe("failed");
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  // ── Not found ──────────────────────────────────────────────────────────

  describe("workflow not found", () => {
    it("throws NotFoundError when workflow does not exist", async () => {
      const logRepo = makeExecutionLogRepo(makeLog());
      const executor = makeNodeExecutor(async () => makeOutput());
      const runner = new WorkflowRunner(
        makeWorkflowRepo(null),
        logRepo,
        executor,
        sorter,
        eventBus
      );

      await expect(runner.run("missing", "t-1", {})).rejects.toThrow(
        /not found/i
      );
    });
  });

  // ── Log repository calls ───────────────────────────────────────────────

  describe("execution log", () => {
    it("creates log with status running at start", async () => {
      const workflow = makeWorkflow();
      const { runner, logRepo } = makeRunner(
        workflow,
        makeLog(),
        async () => makeOutput()
      );

      await runner.run("wf-1", "t-1", {});

      expect(logRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "running", workflowId: "wf-1" })
      );
    });

    it("updates log to completed on success", async () => {
      const workflow = makeWorkflow();
      const { runner, logRepo } = makeRunner(
        workflow,
        makeLog(),
        async () => makeOutput()
      );

      await runner.run("wf-1", "t-1", {});

      expect(logRepo.update).toHaveBeenCalledWith(
        "exec-1",
        expect.objectContaining({ status: "completed" })
      );
    });
  });
});
