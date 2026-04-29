import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

export class NoOpNode implements INode {
  readonly definition: NodeDefinition = {
    type: "noop",
    name: "No Operation",
    description:
      "Pass input through unchanged — useful for testing and debugging",
    configSchema: {
      type: "object",
      properties: {},
    },
  };

  async execute(
    input: unknown,
    _config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    return { data: input };
  }
}
