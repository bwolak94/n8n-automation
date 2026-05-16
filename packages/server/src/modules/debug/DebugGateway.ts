import type { Server as SocketServer, Socket, Namespace } from "socket.io";
import { z } from "zod";
import type { DebugRunner } from "../../engine/DebugRunner.js";
import { createSocketAuthMiddleware } from "../collaboration/socketAuth.js";

// ─── Payload schemas ──────────────────────────────────────────────────────────

const StartSchema = z.object({
  workflowId:  z.string().min(1),
  triggerData: z.record(z.unknown()).default({}),
  breakpoints: z.array(z.string()).default([]),
});

const StepSchema = z.object({
  sessionId: z.string().min(1),
});

const MockSchema = z.object({
  sessionId: z.string().min(1),
  nodeId:    z.string().min(1),
  mockData:  z.unknown(),
});

const CancelSchema = z.object({
  sessionId: z.string().min(1),
});

// ─── DebugGateway ─────────────────────────────────────────────────────────────

export class DebugGateway {
  readonly namespace: Namespace;

  constructor(
    io: SocketServer,
    private readonly debugRunner: DebugRunner
  ) {
    this.namespace = io.of("/debug");
    this.namespace.use(createSocketAuthMiddleware());
    this.namespace.on("connection", (socket) => void this.handleConnection(socket));
  }

  private async handleConnection(socket: Socket): Promise<void> {
    socket.on("debug:start",  (p: unknown) => void this.handleStart(socket, p));
    socket.on("debug:step",   (p: unknown) => void this.handleStep(socket, p));
    socket.on("debug:mock",   (p: unknown) => void this.handleMock(socket, p));
    socket.on("debug:cancel", (p: unknown) => void this.handleCancel(socket, p));
    socket.on("disconnect",   ()           => void this.handleDisconnect(socket));
  }

  /** Returns an emitter bound to the given socket. */
  private emitterFor(socket: Socket) {
    return (event: string, payload: Record<string, unknown>) => {
      socket.emit(event, payload);
    };
  }

  private async handleStart(socket: Socket, payload: unknown): Promise<void> {
    const parsed = StartSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("debug:error", { message: parsed.error.errors[0]?.message ?? "Invalid payload" });
      return;
    }

    const { workflowId, triggerData, breakpoints } = parsed.data;
    const tenantId = (socket.data.tenantId as string | undefined) ?? "";

    try {
      const sessionId = await this.debugRunner.startDebugSession(
        workflowId,
        tenantId,
        socket.id,
        triggerData,
        breakpoints,
        this.emitterFor(socket)
      );
      socket.data.debugSessionId = sessionId;
      socket.emit("debug:sessionCreated", { sessionId });
    } catch (err) {
      socket.emit("debug:error", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  private async handleStep(socket: Socket, payload: unknown): Promise<void> {
    const parsed = StepSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("debug:error", { message: "Invalid step payload" });
      return;
    }

    try {
      await this.debugRunner.stepOver(parsed.data.sessionId, this.emitterFor(socket));
    } catch (err) {
      socket.emit("debug:error", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  private async handleMock(socket: Socket, payload: unknown): Promise<void> {
    const parsed = MockSchema.safeParse(payload);
    if (!parsed.success) {
      socket.emit("debug:error", { message: "Invalid mock payload" });
      return;
    }

    try {
      const { sessionId, nodeId, mockData } = parsed.data;
      await this.debugRunner.setMockOutput(sessionId, nodeId, mockData);
      socket.emit("debug:mockSet", { sessionId, nodeId });
    } catch (err) {
      socket.emit("debug:error", { message: err instanceof Error ? err.message : String(err) });
    }
  }

  private async handleCancel(socket: Socket, payload: unknown): Promise<void> {
    const parsed = CancelSchema.safeParse(payload);
    if (!parsed.success) return;

    try {
      await this.debugRunner.cancelDebugSession(parsed.data.sessionId);
      socket.emit("debug:cancelled", { sessionId: parsed.data.sessionId });
    } catch {
      // Cancellation errors are non-critical — swallow them
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const sessionId = socket.data.debugSessionId as string | undefined;
    if (sessionId) {
      await this.debugRunner.cancelDebugSession(sessionId).catch(() => {});
    }
  }
}
