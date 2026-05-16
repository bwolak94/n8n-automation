import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import type { DebugRunner } from "../../engine/DebugRunner.js";

const SECRET = "test-secret-super-long-string-32ch";

function makeToken(userId = "u1", email = "a@b.com"): string {
  return jwt.sign({ userId, email }, SECRET, { expiresIn: "1h" });
}

// ─── Mock DebugRunner ─────────────────────────────────────────────────────────

function makeMockRunner(): DebugRunner {
  return {
    startDebugSession: jest.fn<DebugRunner["startDebugSession"]>().mockResolvedValue("session-42"),
    stepOver:          jest.fn<DebugRunner["stepOver"]>().mockResolvedValue(undefined),
    setMockOutput:     jest.fn<DebugRunner["setMockOutput"]>().mockResolvedValue(undefined),
    getNodeState:      jest.fn<DebugRunner["getNodeState"]>().mockResolvedValue(null),
    cancelDebugSession: jest.fn<DebugRunner["cancelDebugSession"]>().mockResolvedValue(undefined),
  } as unknown as DebugRunner;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForEvent<T>(
  socket: import("socket.io-client").Socket,
  event:  string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => { clearTimeout(timer); resolve(data); });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DebugGateway", () => {
  let io:      SocketServer;
  let port:    number;
  let runner:  DebugRunner;
  let clients: import("socket.io-client").Socket[] = [];

  async function connect(token = makeToken(), tenantId = "t1") {
    const { io: ioClient } = await import("socket.io-client");
    const client = ioClient(`http://localhost:${port}/debug`, {
      auth:       { token, tenantId },
      transports: ["websocket"],
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once("connect",       resolve);
      client.once("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("connect timeout")), 3000);
    });
    return client;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    runner  = makeMockRunner();
    clients = [];

    const { DebugGateway } = await import("../../modules/debug/DebugGateway.js");

    const httpServer = createServer();
    io = new SocketServer(httpServer, { cors: { origin: "*" } });
    new DebugGateway(io, runner);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  it("rejects connection without token", async () => {
    const { io: ioClient } = await import("socket.io-client");
    const client = ioClient(`http://localhost:${port}/debug`, {
      transports: ["websocket"],
    });
    clients.push(client);

    await expect(new Promise<void>((resolve, reject) => {
      client.once("connect",       () => reject(new Error("should not connect")));
      client.once("connect_error", () => resolve());
      setTimeout(() => reject(new Error("timeout")), 3000);
    })).resolves.toBeUndefined();
  });

  // ── debug:start ───────────────────────────────────────────────────────────

  it("debug:start calls startDebugSession and emits debug:sessionCreated", async () => {
    const client = await connect();

    const created = waitForEvent<{ sessionId: string }>(client, "debug:sessionCreated");
    client.emit("debug:start", {
      workflowId:  "wf-1",
      triggerData: { key: "value" },
      breakpoints: [],
    });

    const data = await created;
    expect(data.sessionId).toBe("session-42");
    expect(runner.startDebugSession).toHaveBeenCalledWith(
      "wf-1",
      "t1",
      expect.any(String),
      { key: "value" },
      [],
      expect.any(Function)
    );
  });

  it("debug:start emits debug:error on runner failure", async () => {
    (runner.startDebugSession as jest.Mock).mockRejectedValueOnce(
      new Error("Workflow not found")
    );

    const client = await connect();

    const errEvent = waitForEvent<{ message: string }>(client, "debug:error");
    client.emit("debug:start", { workflowId: "bad-id" });

    const err = await errEvent;
    expect(err.message).toContain("not found");
  });

  it("debug:start emits debug:error for invalid payload", async () => {
    const client = await connect();

    const errEvent = waitForEvent<{ message: string }>(client, "debug:error");
    client.emit("debug:start", { notAWorkflow: true });

    const err = await errEvent;
    expect(typeof err.message).toBe("string");
  });

  // ── debug:step ────────────────────────────────────────────────────────────

  it("debug:step calls stepOver with the provided sessionId", async () => {
    const client = await connect();

    client.emit("debug:step", { sessionId: "session-42" });

    await new Promise((r) => setTimeout(r, 100));
    expect(runner.stepOver).toHaveBeenCalledWith("session-42", expect.any(Function));
  });

  it("debug:step emits debug:error when stepOver throws", async () => {
    (runner.stepOver as jest.Mock).mockRejectedValueOnce(new Error("Not paused"));

    const client = await connect();

    const errEvent = waitForEvent<{ message: string }>(client, "debug:error");
    client.emit("debug:step", { sessionId: "session-42" });

    const err = await errEvent;
    expect(err.message).toContain("Not paused");
  });

  // ── debug:mock ────────────────────────────────────────────────────────────

  it("debug:mock calls setMockOutput and emits debug:mockSet", async () => {
    const client = await connect();

    const mockSet = waitForEvent<{ sessionId: string; nodeId: string }>(client, "debug:mockSet");
    client.emit("debug:mock", {
      sessionId: "session-42",
      nodeId:    "node-x",
      mockData:  { answer: 42 },
    });

    const ack = await mockSet;
    expect(ack.sessionId).toBe("session-42");
    expect(ack.nodeId).toBe("node-x");
    expect(runner.setMockOutput).toHaveBeenCalledWith("session-42", "node-x", { answer: 42 });
  });

  // ── debug:cancel ──────────────────────────────────────────────────────────

  it("debug:cancel calls cancelDebugSession and emits debug:cancelled", async () => {
    const client = await connect();

    const cancelled = waitForEvent<{ sessionId: string }>(client, "debug:cancelled");
    client.emit("debug:cancel", { sessionId: "session-42" });

    const ack = await cancelled;
    expect(ack.sessionId).toBe("session-42");
    expect(runner.cancelDebugSession).toHaveBeenCalledWith("session-42");
  });

  // ── Disconnect cleanup ─────────────────────────────────────────────────────

  it("cancels session when client disconnects", async () => {
    // Make startDebugSession store the sessionId on socket.data
    const client = await connect();

    const created = waitForEvent<{ sessionId: string }>(client, "debug:sessionCreated");
    client.emit("debug:start", { workflowId: "wf-1" });
    await created;

    // Disconnect
    client.disconnect();

    // Give server time to process disconnect
    await new Promise((r) => setTimeout(r, 150));
    expect(runner.cancelDebugSession).toHaveBeenCalled();
  });

  // ── Emitter forwarding ─────────────────────────────────────────────────────

  it("emitter returned from emitterFor forwards events to the socket", async () => {
    // Capture the emitter passed to startDebugSession and call it manually
    let capturedEmitter: ((event: string, payload: Record<string, unknown>) => void) | undefined;
    (runner.startDebugSession as jest.Mock).mockImplementationOnce(
      async (_wfId, _tid, _sid, _td, _bp, emitter: (e: string, p: Record<string, unknown>) => void) => {
        capturedEmitter = emitter;
        return "session-99";
      }
    );

    const client = await connect();
    const created = waitForEvent<{ sessionId: string }>(client, "debug:sessionCreated");
    client.emit("debug:start", { workflowId: "wf-1" });
    await created;

    const pausedEvent = waitForEvent<{ sessionId: string; nodeId: string }>(client, "debug:paused");
    capturedEmitter!("debug:paused", { sessionId: "session-99", nodeId: "n1" });

    const ev = await pausedEvent;
    expect(ev.nodeId).toBe("n1");
  });
});
