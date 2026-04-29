import { UnknownNodeTypeError } from "../shared/errors/index.js";
import type { INode } from "./contracts/INode.js";

export class NodeRegistry {
  private readonly nodes = new Map<string, INode>();

  register(node: INode): void {
    if (this.nodes.has(node.definition.type)) {
      throw new Error(
        `Node type '${node.definition.type}' is already registered`
      );
    }
    this.nodes.set(node.definition.type, node);
  }

  resolve(type: string): INode {
    const node = this.nodes.get(type);
    if (!node) throw new UnknownNodeTypeError(type);
    return node;
  }

  has(type: string): boolean {
    return this.nodes.has(type);
  }

  listAll(): import("./contracts/INode.js").NodeDefinition[] {
    return [...this.nodes.values()].map((n) => n.definition);
  }
}
