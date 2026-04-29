import { Worker } from "node:worker_threads";
import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

/**
 * Worker thread script (inlined) — runs user code inside a vm2 NodeVM.
 * Using a Worker provides true process-level timeout: `worker.terminate()`
 * kills the thread regardless of what the sandboxed code is doing (including
 * tight `while(true)` loops that block the V8 event loop).
 */
const WORKER_SCRIPT = /* js */ `
  const { parentPort, workerData } = require('worker_threads');
  const { NodeVM } = require('vm2');

  const { code, input, variables } = workerData;

  const vm = new NodeVM({
    sandbox: { input, variables },
    require: false,
    eval: false,
    wasm: false,
  });

  try {
    const result = vm.run('module.exports = (function() { ' + code + ' })();');
    // JSON round-trip to strip sandbox-context prototypes before structured clone
    const safe = JSON.parse(JSON.stringify(result === undefined ? null : result));
    parentPort.postMessage({ ok: true, result: safe });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: String(err.message ?? err) });
  }
`;

export class JavaScriptNode implements INode {
  readonly definition: NodeDefinition = {
    type: "javascript",
    name: "JavaScript",
    description: "Execute custom JavaScript code in a sandboxed environment",
    configSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: {
          type: "string",
          description:
            "JavaScript code to execute. Use `return` to produce output.",
        },
        timeoutMs: {
          type: "number",
          default: 5000,
          description: "Execution timeout in milliseconds",
        },
      },
    },
  };

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const code = config["code"] as string | undefined;
    const timeoutMs = (config["timeoutMs"] as number | undefined) ?? 5000;

    if (!code) {
      throw new AppError(
        "JavaScriptNode requires code",
        400,
        "JS_MISSING_CODE"
      );
    }

    const startedAt = Date.now();
    const result = await this.runInWorker(
      code,
      input,
      { ...context.variables },
      timeoutMs
    );
    const executionMs = Date.now() - startedAt;

    return { data: { result, executionMs } };
  }

  private runInWorker(
    code: string,
    input: unknown,
    variables: Record<string, unknown>,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const worker = new Worker(WORKER_SCRIPT, {
        eval: true,
        workerData: { code, input, variables },
      });

      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new AppError("Script execution timed out", 408, "JS_TIMEOUT"));
      }, timeoutMs);

      worker.once("message", (msg: { ok: boolean; result?: unknown; error?: string }) => {
        clearTimeout(timer);
        void worker.terminate();
        if (msg.ok) {
          resolve(msg.result);
        } else {
          reject(new AppError(msg.error ?? "Script error", 400, "JS_RUNTIME_ERROR"));
        }
      });

      worker.once("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
