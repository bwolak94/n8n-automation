import { describe, it, expect } from "@jest/globals";
import { NodeRegistry } from "../nodes/NodeRegistry.js";
import { UnknownNodeTypeError } from "../shared/errors/index.js";
import type { INode, NodeDefinition, NodeOutput, ExecutionContext } from "../nodes/contracts/INode.js";

function makeNode(type: string): INode {
  return {
    definition: { type, name: `${type} node` } satisfies NodeDefinition,
    execute: async (_input: unknown, _config: Record<string, unknown>, _ctx: ExecutionContext): Promise<NodeOutput> =>
      ({ data: null }),
  };
}

describe("NodeRegistry", () => {
  it("registers and resolves a node by type", () => {
    const registry = new NodeRegistry();
    const node = makeNode("http");
    registry.register(node);
    expect(registry.resolve("http")).toBe(node);
  });

  it("has() returns true for registered types", () => {
    const registry = new NodeRegistry();
    registry.register(makeNode("email"));
    expect(registry.has("email")).toBe(true);
  });

  it("has() returns false for unknown types", () => {
    const registry = new NodeRegistry();
    expect(registry.has("unknown")).toBe(false);
  });

  it("throws UnknownNodeTypeError when resolving an unregistered type", () => {
    const registry = new NodeRegistry();
    expect(() => registry.resolve("ghost")).toThrow(UnknownNodeTypeError);
  });

  it("throws on duplicate registration of the same type", () => {
    const registry = new NodeRegistry();
    registry.register(makeNode("http"));
    expect(() => registry.register(makeNode("http"))).toThrow(
      /already registered/
    );
  });

  it("resolves multiple distinct types independently", () => {
    const registry = new NodeRegistry();
    const httpNode = makeNode("http");
    const emailNode = makeNode("email");
    registry.register(httpNode);
    registry.register(emailNode);
    expect(registry.resolve("http")).toBe(httpNode);
    expect(registry.resolve("email")).toBe(emailNode);
  });
});
