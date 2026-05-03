import type { Server as HttpServer } from "http";
import { Server as SocketServer, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Redis } from "ioredis";
import type { CanvasOp } from "./CanvasOp.js";
import { transformOp } from "./CanvasOp.js";
import type { IOpLogRepository } from "./OpLogRepository.js";
import { createSocketAuthMiddleware } from "./socketAuth.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpSubmitPayload {
  readonly op: CanvasOp;
  readonly baseVersion: number;
}

// ─── Gateway ──────────────────────────────────────────────────────────────────

export class CollaborationGateway {
  readonly io: SocketServer;

  constructor(
    httpServer: HttpServer,
    private readonly opLogRepo: IOpLogRepository,
    corsOrigin: string,
    pubClient?: Redis | null,
    subClient?: Redis | null
  ) {
    this.io = new SocketServer(httpServer, {
      cors: { origin: corsOrigin, credentials: true },
    });

    /* istanbul ignore next */
    if (pubClient && subClient) {
      this.io.adapter(createAdapter(pubClient, subClient));
    }

    this.io.use(createSocketAuthMiddleware());
    this.io.on("connection", (socket) => void this.handleConnection(socket));
  }

  private async handleConnection(socket: Socket): Promise<void> {
    socket.on("workflow:join", (workflowId: unknown) =>
      void this.handleJoin(socket, workflowId)
    );

    socket.on("op:submit", (payload: unknown) =>
      void this.handleOpSubmit(socket, payload)
    );

    socket.on("cursor:move", (cursor: unknown) =>
      this.handleCursorMove(socket, cursor)
    );

    socket.on("disconnecting", () => void this.handleDisconnecting(socket));
  }

  private async handleJoin(socket: Socket, workflowId: unknown): Promise<void> {
    if (!workflowId || typeof workflowId !== "string") return;

    const room = `workflow:${workflowId}`;
    await socket.join(room);
    socket.data.workflowId = workflowId;

    const state = await this.opLogRepo.getState(workflowId);
    socket.emit("workflow:state", state);

    socket.to(room).emit("peer:joined", {
      userId: socket.data.userId as string,
      email: socket.data.email as string,
    });
  }

  private async handleOpSubmit(socket: Socket, payload: unknown): Promise<void> {
    const workflowId = socket.data.workflowId as string | undefined;
    if (!workflowId || !isOpSubmitPayload(payload)) return;

    const { op, baseVersion } = payload;
    const room = `workflow:${workflowId}`;

    const state = await this.opLogRepo.getState(workflowId);

    // Concurrent ops = those applied after the client's last seen version
    const concurrentOps = state.ops
      .filter((e) => e.version > baseVersion)
      .map((e) => e.op);

    const result = transformOp(op, concurrentOps);

    if (result.outcome === "reject") {
      socket.emit("op:rejected", {
        op,
        reason: result.reason,
        serverVersion: state.version,
        ops: state.ops,
      });
      return;
    }

    const version = await this.opLogRepo.append(
      workflowId,
      (socket.data.tenantId as string | undefined) ?? "",
      socket.data.userId as string,
      op
    );

    this.io.to(room).emit("op:applied", {
      op,
      version,
      userId: socket.data.userId as string,
    });
  }

  private handleCursorMove(socket: Socket, cursor: unknown): void {
    const workflowId = socket.data.workflowId as string | undefined;
    if (!workflowId || !isCursorPayload(cursor)) return;

    const room = `workflow:${workflowId}`;
    socket.to(room).emit("cursor:updated", {
      userId: socket.data.userId as string,
      cursor,
    });
  }

  private async handleDisconnecting(socket: Socket): Promise<void> {
    const workflowId = socket.data.workflowId as string | undefined;
    if (!workflowId) return;

    const room = `workflow:${workflowId}`;
    socket.to(room).emit("peer:left", {
      userId: socket.data.userId as string,
    });
  }
}

// ─── Type guards ──────────────────────────────────────────────────────────────

function isOpSubmitPayload(payload: unknown): payload is OpSubmitPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "op" in payload &&
    "baseVersion" in payload &&
    typeof (payload as Record<string, unknown>).op === "object" &&
    typeof (payload as Record<string, unknown>).baseVersion === "number"
  );
}

function isCursorPayload(cursor: unknown): cursor is { x: number; y: number } {
  return (
    typeof cursor === "object" &&
    cursor !== null &&
    "x" in cursor &&
    "y" in cursor &&
    typeof (cursor as Record<string, unknown>).x === "number" &&
    typeof (cursor as Record<string, unknown>).y === "number"
  );
}
