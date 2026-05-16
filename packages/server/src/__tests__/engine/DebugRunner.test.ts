import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { DebugRunner } from "../../engine/DebugRunner.js";
import type { IDebugRedis, DebugEmitter } from "../../engine/DebugRunner.js";
import type { IWorkflowRepository, WorkflowDefinition } from "../../engine/types.js";
import type { NodeExecutor } from "../../engine/NodeExecutor.js";
import type { NodeOutput } from "../../nodes/contracts/INode.js";
import { TopologicalSorter } from "../../engine/TopologicalSorter.js";
import { AppError } from "../../shared/errors/index.js";

// ─── Mock Redis ───────────────────────────────────────────────────────────────

function makeMockRedis(): IDebugRedis & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    _store: store,
    get:    jest.fn(async (key: string) => store.get(key) ?? null) as IDebugRedis["get"],
    set:    jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK" as const;
    }) as IDebugRedis["set"],
    del:    jest.fn(async (...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return keys.length;
    }) as IDebugRedis["del"],
  };
}

// ─── Factories ────────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id:       "wf-1",
    tenantId: "tenant-1",
    nodes: [
      { id: "node-a", type: "noop", config: {} },
      { id: "node-b", type: "noop", config: {} },
    ],
    edges:     [{ from: "node-a", to: "node-b" }],
    variables: {},
    ...overrides,
  };
}

function makeWorkflowRepo(workflow: WorkflowDefinition | null = makeWorkflow()): IWorkflowRepository {
  return {
    findById: jest.fn<IWorkflowRepository["findById"]>().mockResolvedValue(workflow),
  };
}

function makeNodeExecutor(outputData: unknown = { ok: true }): NodeExecutor {
  return {
    execute: jest.fn<NodeExecutor["execute"]>().mockResolvedValue({ data: outputData }),
  } as unknown as NodeExecutor;
}

function makeEmitter(): { emitter: DebugEmitter; calls: [string, Record<string, unknown>][] } {
  const calls: [string, Record<string, unknown>][] = [];
  const emitter: DebugEmitter = (event, payload) => calls.push([event, payload]);
  return { emitter, calls };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DebugRunner", () => {
  let redis:    ReturnType<typeof makeMockRedis>;
  let sorter:   TopologicalSorter;
  let runner:   DebugRunner;

  beforeEach(() => {
    redis  = makeMockRedis();
    sorter = new TopologicalSorter();
  });

  // ── startDebugSession ──────────────────────────────────────────────────────

  describe("startDebugSession()", () => {
    it("initialises session in Redis with correct structure", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      const sessionId   = await runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, [], emitter);

      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);

      // Session should be in Redis
      const raw = redis._store.get(`debug:session:${sessionId}`);
      expect(raw).toBeDefined();
      const session = JSON.parse(raw!) as Record<string, unknown>;
      expect(session["workflowId"]).toBe("wf-1");
      expect(session["tenantId"]).toBe("tenant-1");
      expect(session["socketId"]).toBe("sock-1");
    });

    it("stores tenant active session key while session is paused", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      // Use a breakpoint so the session stays paused (key is NOT deleted yet)
      const sessionId = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter
      );

      const tenantEntry = redis._store.get("debug:tenant:tenant-1:active");
      expect(tenantEntry).toBe(sessionId);
    });

    it("throws 409 when a session is already active for the tenant", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      // Pre-seed an active session
      await redis.set("debug:tenant:tenant-1:active", "existing-session-id", "EX", 1800);

      const { emitter } = makeEmitter();
      await expect(
        runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, [], emitter)
      ).rejects.toThrow(AppError);
    });

    it("throws 404 for unknown workflow", async () => {
      const repo     = makeWorkflowRepo(null);
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      await expect(
        runner.startDebugSession("missing", "tenant-1", "sock-1", {}, [], emitter)
      ).rejects.toThrow("not found");
    });

    it("emits debug:nodeStart and debug:nodeEnd for each node", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor({ result: 42 });
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter, calls } = makeEmitter();
      await runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, [], emitter);

      const events = calls.map(([e]) => e);
      expect(events).toContain("debug:nodeStart");
      expect(events).toContain("debug:nodeEnd");
      expect(events).toContain("debug:complete");
    });

    it("emits debug:paused at breakpoint node without executing it", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter, calls } = makeEmitter();
      // Breakpoint on node-a (first node)
      await runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter);

      const events = calls.map(([e]) => e);
      expect(events).toContain("debug:paused");
      expect(events).not.toContain("debug:complete");

      // node-a should NOT have been executed (executor not called)
      expect(executor.execute).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: "node-a" }),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  // ── stepOver ──────────────────────────────────────────────────────────────

  describe("stepOver()", () => {
    it("advances from a paused node and emits nodeStart/nodeEnd", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor({ val: 1 });
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter, calls } = makeEmitter();
      // Start with breakpoint on node-a
      const sessionId = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter
      );

      // Verify paused at node-a
      expect(calls.map(([e]) => e)).toContain("debug:paused");

      // Step over
      const { emitter: emitter2, calls: calls2 } = makeEmitter();
      await runner.stepOver(sessionId, emitter2);

      const events2 = calls2.map(([e]) => e);
      expect(events2).toContain("debug:nodeStart");
      expect(events2).toContain("debug:nodeEnd");
      // node-b has no breakpoint → continues to complete
      expect(events2).toContain("debug:complete");
    });

    it("pauses at next breakpoint when stepping", async () => {
      const workflow = makeWorkflow({
        nodes: [
          { id: "n1", type: "noop", config: {} },
          { id: "n2", type: "noop", config: {} },
          { id: "n3", type: "noop", config: {} },
        ],
        edges: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }],
      });

      const repo     = makeWorkflowRepo(workflow);
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      // Breakpoints on n1 and n3
      const sessionId = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, ["n1", "n3"], emitter
      );

      // Step over n1 → should run n1, n2, then pause at n3
      const { emitter: e2, calls: c2 } = makeEmitter();
      await runner.stepOver(sessionId, e2);

      const events2 = c2.map(([ev]) => ev);
      expect(events2).toContain("debug:paused");
      expect(events2).not.toContain("debug:complete");

      // Paused at n3
      const pausedEvent = c2.find(([ev]) => ev === "debug:paused");
      expect(pausedEvent?.[1]["nodeId"]).toBe("n3");
    });

    it("throws 404 for unknown session", async () => {
      runner = new DebugRunner(makeWorkflowRepo(), makeNodeExecutor(), sorter, redis);
      const { emitter } = makeEmitter();
      await expect(runner.stepOver("no-such-session", emitter)).rejects.toThrow("not found");
    });

    it("throws 400 when session is not paused", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      // No breakpoints → completes immediately
      const sessionId = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, [], emitter
      );

      const { emitter: e2 } = makeEmitter();
      await expect(runner.stepOver(sessionId, e2)).rejects.toThrow(AppError);
    });
  });

  // ── setMockOutput ─────────────────────────────────────────────────────────

  describe("setMockOutput()", () => {
    it("stores mock; subsequent node execution uses mock data instead of real output", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor({ real: true });
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      // Pause at node-a
      const sessionId = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter
      );

      // Register mock for node-a
      await runner.setMockOutput(sessionId, "node-a", { mocked: true });

      // Step over — node-a should use mock, executor should NOT be called for node-a
      const { emitter: e2, calls: c2 } = makeEmitter();
      await runner.stepOver(sessionId, e2);

      // Find node-a's nodeEnd payload
      const nodeAEnd = c2.find(
        ([ev, p]) => ev === "debug:nodeEnd" && p["nodeId"] === "node-a"
      );
      expect(nodeAEnd?.[1]["output"]).toEqual({ mocked: true });

      // executor was NOT called for node-a (mock was used)
      const execCalls = (executor.execute as jest.Mock).mock.calls;
      const calledNodeIds = execCalls.map(
        (args) => (args[0] as { id: string }).id
      );
      expect(calledNodeIds).not.toContain("node-a");
    });
  });

  // ── getNodeState ──────────────────────────────────────────────────────────

  describe("getNodeState()", () => {
    it("returns null for unknown session", async () => {
      runner = new DebugRunner(makeWorkflowRepo(), makeNodeExecutor(), sorter, redis);
      const result = await runner.getNodeState("no-session", "n1");
      expect(result).toBeNull();
    });

    it("returns the stored state after execution", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor({ answer: 42 });
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      const sessionId   = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, [], emitter
      );

      const state = await runner.getNodeState(sessionId, "node-a");
      expect(state?.status).toBe("completed");
    });
  });

  // ── cancelDebugSession ────────────────────────────────────────────────────

  describe("cancelDebugSession()", () => {
    it("removes session and tenant key from Redis", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      const sessionId   = await runner.startDebugSession(
        "wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter
      );

      await runner.cancelDebugSession(sessionId);

      expect(redis._store.has(`debug:session:${sessionId}`)).toBe(false);
      expect(redis._store.has("debug:tenant:tenant-1:active")).toBe(false);
    });

    it("is idempotent — no error when session does not exist", async () => {
      runner = new DebugRunner(makeWorkflowRepo(), makeNodeExecutor(), sorter, redis);
      await expect(runner.cancelDebugSession("ghost-id")).resolves.not.toThrow();
    });
  });

  // ── Breakpoint pauses BEFORE the node ────────────────────────────────────

  describe("breakpoint behaviour", () => {
    it("paused event is emitted BEFORE nodeStart for the breakpoint node", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter, calls } = makeEmitter();
      await runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, ["node-a"], emitter);

      // node-a has breakpoint → should emit paused, NOT nodeStart for node-a
      expect(calls.map(([e]) => e)).not.toContain("debug:nodeStart");
      expect(calls.map(([e]) => e)).toContain("debug:paused");
      expect(calls[0]![0]).toBe("debug:paused");
    });
  });

  // ── debug:complete removes tenant active session marker ───────────────────

  describe("session cleanup on completion", () => {
    it("removes tenant key when session completes", async () => {
      const repo     = makeWorkflowRepo();
      const executor = makeNodeExecutor();
      runner         = new DebugRunner(repo, executor, sorter, redis);

      const { emitter } = makeEmitter();
      await runner.startDebugSession("wf-1", "tenant-1", "sock-1", {}, [], emitter);

      // After completion, tenant can start a new session
      expect(redis._store.has("debug:tenant:tenant-1:active")).toBe(false);
    });
  });
});
