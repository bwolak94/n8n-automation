import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { NodeExecutor } from "../engine/NodeExecutor.js";
import { NodeRegistry } from "../nodes/NodeRegistry.js";
import { ExpressionEvaluator } from "../engine/ExpressionEvaluator.js";
import { RetryManager } from "../engine/RetryManager.js";
import { EventBus } from "../engine/EventBus.js";
import type { INode, NodeOutput, ExecutionContext } from "../nodes/contracts/INode.js";
import type { ExpressionContext, WorkflowNode } from "../engine/types.js";
import type { IDLQueue } from "../engine/RetryManager.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const execCtx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
};

const exprCtx: ExpressionContext = {
  nodes: {},
  variables: {},
  trigger: { event: "test" },
};

const workflowNode: WorkflowNode = {
  id: "n1",
  type: "http",
  config: { url: "https://example.com" },
};

function makeTestNode(
  handler: () => Promise<NodeOutput> = async () => ({ data: "result" })
): INode {
  return {
    definition: { type: "http", name: "HTTP Node" },
    execute: jest.fn(handler) as INode["execute"],
  };
}

function makeDlq(): IDLQueue {
  return { add: jest.fn(async () => {}) as IDLQueue["add"] };
}

function makeExecutor(node?: INode): {
  executor: NodeExecutor;
  registry: NodeRegistry;
  eventBus: EventBus;
  dlq: IDLQueue;
  testNode: INode;
} {
  const registry = new NodeRegistry();
  const testNode = node ?? makeTestNode();
  registry.register(testNode);

  const evaluator = new ExpressionEvaluator();
  const dlq = makeDlq();
  const retryManager = new RetryManager(dlq, async () => {}); // no-op sleep
  const eventBus = new EventBus();

  const executor = new NodeExecutor(registry, evaluator, retryManager, eventBus);
  return { executor, registry, eventBus, dlq, testNode };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("NodeExecutor", () => {
  describe("successful execution", () => {
    it("calls INode.execute() and returns NodeOutput", async () => {
      const output: NodeOutput = { data: { id: 1 } };
      const { executor } = makeExecutor(makeTestNode(async () => output));

      const result = await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(result).toBe(output);
    });

    it("passes resolved config to INode.execute()", async () => {
      const registry = new NodeRegistry();
      const capturedConfig: Record<string, unknown>[] = [];
      const testNode: INode = {
        definition: { type: "http", name: "HTTP" },
        execute: jest.fn(async (_input, config) => {
          capturedConfig.push(config);
          return { data: null };
        }) as INode["execute"],
      };
      registry.register(testNode);

      const evaluator = new ExpressionEvaluator();
      const retryManager = new RetryManager(makeDlq(), async () => {});
      const eventBus = new EventBus();
      const executor = new NodeExecutor(registry, evaluator, retryManager, eventBus);

      const nodeWithExpr: WorkflowNode = {
        id: "n1",
        type: "http",
        config: { url: "static-url", event: "{{trigger.event}}" },
      };

      await executor.execute(nodeWithExpr, {}, exprCtx, execCtx);

      expect(capturedConfig[0]).toEqual({ url: "static-url", event: "test" });
    });
  });

  describe("event emission", () => {
    it("emits step.started before execution", async () => {
      const emitted: string[] = [];
      const { executor, eventBus } = makeExecutor();
      eventBus.on("step.started", () => { emitted.push("step.started"); });

      await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(emitted).toContain("step.started");
    });

    it("emits step.completed after successful execution", async () => {
      const emitted: string[] = [];
      const { executor, eventBus } = makeExecutor();
      eventBus.on("step.completed", () => { emitted.push("step.completed"); });

      await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(emitted).toContain("step.completed");
    });

    it("emits events in order: step.started → step.completed", async () => {
      const order: string[] = [];
      const { executor, eventBus } = makeExecutor();
      eventBus.on("step.started", () => order.push("started"));
      eventBus.on("step.completed", () => order.push("completed"));

      await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(order).toEqual(["started", "completed"]);
    });

    it("emits step.started → step.failed on error", async () => {
      const order: string[] = [];
      const failingNode = makeTestNode(async () => { throw new Error("node fail"); });
      const { executor, eventBus } = makeExecutor(failingNode);

      eventBus.on("step.started", () => order.push("started"));
      eventBus.on("step.failed", () => order.push("failed"));

      await expect(
        executor.execute(workflowNode, {}, exprCtx, execCtx)
      ).rejects.toThrow("node fail");

      expect(order).toEqual(["started", "failed"]);
    });

    it("step.started event contains correct nodeId and nodeType", async () => {
      let capturedEvent: { nodeId: string; nodeType: string } | null = null;
      const { executor, eventBus } = makeExecutor();
      eventBus.on("step.started", (e) => {
        capturedEvent = { nodeId: e.nodeId, nodeType: e.nodeType };
      });

      await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(capturedEvent).toEqual({ nodeId: "n1", nodeType: "http" });
    });

    it("step.completed event contains the output", async () => {
      const output: NodeOutput = { data: "done" };
      let capturedOutput: NodeOutput | null = null;
      const { executor, eventBus } = makeExecutor(makeTestNode(async () => output));

      eventBus.on("step.completed", (e) => { capturedOutput = e.output; });

      await executor.execute(workflowNode, {}, exprCtx, execCtx);

      expect(capturedOutput).toBe(output);
    });
  });

  describe("retry integration", () => {
    it("retries the node when it fails and eventually succeeds", async () => {
      let callCount = 0;
      const flakyNode = makeTestNode(async () => {
        callCount++;
        if (callCount < 3) throw new Error("transient");
        return { data: "ok" };
      });
      const { executor } = makeExecutor(flakyNode);

      const nodeWithRetry: WorkflowNode = {
        ...workflowNode,
        retry: { maxAttempts: 3, backoffStrategy: "fixed", backoffDelay: 0 },
      };

      const result = await executor.execute(nodeWithRetry, {}, exprCtx, execCtx);

      expect(callCount).toBe(3);
      expect(result.data).toBe("ok");
    });

    it("sends failed job to DLQ after exhausting retries", async () => {
      const registry = new NodeRegistry();
      const alwaysFails = makeTestNode(async () => { throw new Error("permanent"); });
      registry.register(alwaysFails);

      const evaluator = new ExpressionEvaluator();
      const dlq = makeDlq();
      const retryManager = new RetryManager(dlq, async () => {});
      const eventBus = new EventBus();
      const executor = new NodeExecutor(registry, evaluator, retryManager, eventBus);

      const nodeWithRetry: WorkflowNode = {
        ...workflowNode,
        retry: { maxAttempts: 2, backoffStrategy: "fixed", backoffDelay: 0 },
      };

      await expect(
        executor.execute(nodeWithRetry, {}, exprCtx, execCtx)
      ).rejects.toThrow("permanent");

      expect(dlq.add).toHaveBeenCalledTimes(1);
      expect(dlq.add).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: "n1",
          executionId: "exec-1",
          tenantId: "t-1",
        })
      );
    });
  });

  describe("error propagation", () => {
    it("re-throws the error from INode.execute()", async () => {
      const err = new Error("specific error");
      const failingNode = makeTestNode(async () => { throw err; });
      const { executor } = makeExecutor(failingNode);

      await expect(
        executor.execute(workflowNode, {}, exprCtx, execCtx)
      ).rejects.toThrow("specific error");
    });
  });
});
