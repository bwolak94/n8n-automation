import type { NextFunction, Request, Response } from "express";
import type { ExecutionService } from "./ExecutionService.js";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const SSE_POLL_MS = 500;

export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const exec = await this.executionService.findById(req.params["id"]!, req.tenantId!);
      res.json(exec);
    } catch (err) {
      next(err);
    }
  };

  streamLogs = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const send = (event: string, data: unknown): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Initial lookup
    const execution = await this.executionService.findByIdOrNull(id, tenantId);
    if (!execution) {
      send("error", { code: "EXECUTION_NOT_FOUND" });
      res.end();
      return;
    }

    // Already terminal — emit one snapshot and close
    if (TERMINAL.has(execution.status)) {
      send("log", execution);
      send("done", { status: execution.status });
      res.end();
      return;
    }

    // Poll until terminal or client disconnects
    const timer = setInterval(async () => {
      try {
        const current = await this.executionService.findByIdOrNull(id, tenantId);
        if (!current) {
          clearInterval(timer);
          send("error", { code: "EXECUTION_NOT_FOUND" });
          res.end();
          return;
        }
        send("log", current);
        if (TERMINAL.has(current.status)) {
          clearInterval(timer);
          send("done", { status: current.status });
          res.end();
        }
      } catch {
        clearInterval(timer);
        res.end();
      }
    }, SSE_POLL_MS);

    req.on("close", () => clearInterval(timer));
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.executionService.cancel(req.params["id"]!, req.tenantId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };
}
