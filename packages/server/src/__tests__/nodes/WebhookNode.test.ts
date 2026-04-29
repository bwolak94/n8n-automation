import { beforeEach, describe, expect, it } from "@jest/globals";
import { WebhookNode } from "../../nodes/implementations/WebhookNode.js";
import { WebhookRegistry } from "../../nodes/WebhookRegistry.js";
import type { ExecutionContext } from "../../nodes/contracts/INode.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ctx: ExecutionContext = {
  tenantId: "t-1",
  executionId: "exec-1",
  workflowId: "wf-1",
  variables: {},
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("WebhookNode", () => {
  let registry: WebhookRegistry;
  let node: WebhookNode;

  beforeEach(() => {
    registry = new WebhookRegistry();
    node = new WebhookNode(registry);
  });

  it("has correct definition type", () => {
    expect(node.definition.type).toBe("webhook");
  });

  it("registers the path with the registry on execute", async () => {
    await node.execute({}, { path: "/orders", method: "POST" }, ctx);

    expect(registry.has("/orders", "POST")).toBe(true);
  });

  it("defaults method to POST when not specified", async () => {
    await node.execute({}, { path: "/events" }, ctx);

    expect(registry.has("/events", "POST")).toBe(true);
  });

  it("registers the method normalised to uppercase", async () => {
    await node.execute({}, { path: "/hook", method: "post" }, ctx);

    expect(registry.has("/hook", "POST")).toBe(true);
  });

  it("throws on duplicate path + method registration", async () => {
    await node.execute({}, { path: "/dup", method: "POST" }, ctx);

    await expect(
      node.execute({}, { path: "/dup", method: "POST" }, ctx)
    ).rejects.toThrow("already registered");
  });

  it("allows same path with different methods", async () => {
    await node.execute({}, { path: "/resource", method: "GET" }, ctx);

    await expect(
      node.execute({}, { path: "/resource", method: "POST" }, ctx)
    ).resolves.toBeDefined();
  });

  it("returns incoming request data from input", async () => {
    const incoming = {
      headers: { "content-type": "application/json" },
      body: { event: "order.created", orderId: "o-1" },
      queryParams: { debug: "true" },
      method: "POST",
    };

    const output = await node.execute(incoming, { path: "/webhook" }, ctx);
    const data = output.data as Record<string, unknown>;

    expect(data["headers"]).toEqual(incoming.headers);
    expect(data["body"]).toEqual(incoming.body);
    expect(data["queryParams"]).toEqual(incoming.queryParams);
    expect(data["method"]).toBe("POST");
  });

  it("returns empty defaults when input has no request data", async () => {
    const output = await node.execute(null, { path: "/empty" }, ctx);
    const data = output.data as Record<string, unknown>;

    expect(data["headers"]).toEqual({});
    expect(data["body"]).toBeNull();
    expect(data["queryParams"]).toEqual({});
  });

  it("throws when path is missing", async () => {
    await expect(node.execute({}, {}, ctx)).rejects.toThrow(
      "WebhookNode requires a path"
    );
  });
});
