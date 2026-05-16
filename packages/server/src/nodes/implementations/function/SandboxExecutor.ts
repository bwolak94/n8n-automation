import ivm from "isolated-vm";
import { AppError } from "../../../shared/errors/index.js";
import { CONSOLE_SETUP_CODE, SANDBOX_UTILS_CODE } from "./SandboxUtils.js";

export interface SandboxResult {
  readonly output: unknown;
  readonly logs: string[];
}

/**
 * Executes user-supplied JavaScript in a locked-down V8 isolate.
 *
 * Guarantees:
 *  - No access to Node.js APIs, filesystem, or network
 *  - Execution timeout enforced at the V8 level
 *  - Memory cap via Isolate memoryLimit
 *  - Isolate disposed after each call (no cross-run state leakage)
 */
export class SandboxExecutor {
  async execute(
    code: string,
    inputData: unknown,
    timeoutMs = 5_000,
    memoryMb = 32
  ): Promise<SandboxResult> {
    const isolate = new ivm.Isolate({ memoryLimit: memoryMb });
    try {
      const context = await isolate.createContext();

      // Inject $input — serialised copy into the isolate heap
      const safeInput = this.toSafeValue(inputData);
      await context.global.set("$input", new ivm.ExternalCopy(safeInput).copyInto());

      // Console capture shim + utility library
      await context.eval(CONSOLE_SETUP_CODE);
      await context.eval(SANDBOX_UTILS_CODE);

      // Wrap user code so `return` works and result is JSON-safe
      const wrapped = `(function() { ${code} })()`;

      let rawOutput: unknown;
      try {
        rawOutput = await context.eval(wrapped, { copy: true, timeout: timeoutMs });
      } catch (err) {
        throw this.mapError(err);
      }

      // Read captured console logs
      let logs: string[] = [];
      try {
        const captured = await context.eval("__sandbox_logs", { copy: true });
        if (Array.isArray(captured)) logs = captured as string[];
      } catch {
        // ignore log retrieval failure
      }

      return { output: rawOutput ?? null, logs };
    } finally {
      isolate.dispose();
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Deep JSON round-trip to strip non-serialisable values before passing in. */
  private toSafeValue(val: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(val ?? null)) as unknown;
    } catch {
      return null;
    }
  }

  private mapError(err: unknown): AppError {
    // Avoid instanceof Error — isolated-vm errors may come from a different realm
    // in Jest's experimental-vm-modules sandbox.
    const msg: string =
      err !== null &&
      err !== undefined &&
      typeof (err as Record<string, unknown>)["message"] === "string"
        ? ((err as Record<string, unknown>)["message"] as string)
        : String(err);

    if (msg.includes("timed out") || msg.includes("Script execution timed out")) {
      return new AppError(
        "Function execution timed out",
        408,
        "FUNCTION_TIMEOUT"
      );
    }
    if (
      msg.includes("memory limit") ||
      msg.includes("Isolate was disposed") ||
      msg.includes("out of memory")
    ) {
      return new AppError(
        "Function exceeded memory limit",
        400,
        "FUNCTION_MEMORY_EXCEEDED"
      );
    }
    return new AppError(msg, 400, "FUNCTION_RUNTIME_ERROR");
  }
}
