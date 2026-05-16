import { FunctionNodeConfigSchema } from "@automation-hub/shared";
import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import { SandboxExecutor } from "./function/SandboxExecutor.js";

export class FunctionNode implements INode {
  readonly definition: NodeDefinition = {
    type: "function",
    name: "Function",
    description:
      "Run custom JavaScript in a sandboxed V8 isolate. Use `return { ... }` to produce output. `$input` holds upstream data.",
    configSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", description: "JavaScript source code" },
        timeoutMs: { type: "number", default: 5000, description: "Timeout in ms (max 30000)" },
        memoryMb: { type: "number", default: 32, description: "Heap limit in MB (max 256)" },
      },
    },
  };

  constructor(private readonly sandbox: SandboxExecutor = new SandboxExecutor()) {}

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const parsed = FunctionNodeConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new AppError(
        `FunctionNode config invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        400,
        "FUNCTION_INVALID_CONFIG"
      );
    }

    const { code, timeoutMs, memoryMb } = parsed.data;
    const result = await this.sandbox.execute(code, input, timeoutMs, memoryMb);

    return {
      data: result.output,
      ...(result.logs.length > 0 ? { metadata: { logs: result.logs } } : {}),
    };
  }
}
