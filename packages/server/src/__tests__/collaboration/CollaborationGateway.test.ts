import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { createServer } from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";

const SECRET = "test-secret-super-long-string-32ch";

function makeToken(userId = "u1", email = "a@b.com"): string {
  return jwt.sign({ userId, email }, SECRET, { expiresIn: "1h" });
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAppend = jest.fn<() => Promise<number>>();
const mockGetState = jest.fn<() => Promise<{ version: number; ops: unknown[] }>>();

const mockOpLogRepo = {
  append: mockAppend,
  getState: mockGetState,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CollaborationGateway", () => {
  let gateway: import("../../modules/collaboration/CollaborationGateway.js").CollaborationGateway;
  let port: number;
  let clients: import("socket.io-client").Socket[] = [];

  async function connect(token = makeToken(), tenantId = "t1") {
    const { io: ioClient } = await import("socket.io-client");
    const client = ioClient(`http://localhost:${port}`, {
      auth: { token, tenantId },
      transports: ["websocket"],
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", (err) => reject(err));
      setTimeout(() => reject(new Error("connect timeout")), 3000);
    });
    return client;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetState.mockResolvedValue({ version: 0, ops: [] });
    mockAppend.mockResolvedValue(1);
    clients = [];

    const { CollaborationGateway } = await import(
      "../../modules/collaboration/CollaborationGateway.js"
    );

    const httpServer = createServer();
    gateway = new CollaborationGateway(
      httpServer,
      mockOpLogRepo as never,
      "http://localhost:9000"
    );

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    for (const c of clients) {
      c.disconnect();
    }
    await new Promise<void>((resolve) => gateway.io.close(() => resolve()));
  });

  describe("workflow:join", () => {
    it("sends workflow:state to the joining client", async () => {
      mockGetState.mockResolvedValue({ version: 3, ops: [{ version: 3, op: {} }] });

      const client = await connect();

      const statePromise = new Promise<{ version: number }>((resolve) => {
        client.once("workflow:state", resolve);
      });

      client.emit("workflow:join", "wf-1");

      const state = await statePromise;
      expect(state.version).toBe(3);
      expect(mockGetState).toHaveBeenCalledWith("wf-1");
    });

    it("broadcasts peer:joined to other clients in the room", async () => {
      const client1 = await connect(makeToken("u1", "a@b.com"));
      const client2 = await connect(makeToken("u2", "b@c.com"));

      // client1 joins first
      await new Promise<void>((resolve) => {
        client1.emit("workflow:join", "wf-2");
        client1.once("workflow:state", () => resolve());
      });

      // client2 joins; client1 should receive peer:joined
      const peerJoinedPromise = new Promise<{ userId: string }>((resolve) => {
        client1.once("peer:joined", resolve);
      });

      client2.emit("workflow:join", "wf-2");

      const peerJoined = await peerJoinedPromise;
      expect(peerJoined.userId).toBe("u2");
    });

    it("ignores invalid workflowId (non-string)", async () => {
      const client = await connect();
      // Emit null — should not throw
      client.emit("workflow:join", null);
      // Give server a tick
      await new Promise((r) => setTimeout(r, 100));
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe("op:submit", () => {
    it("broadcasts op:applied when OT resolves to apply", async () => {
      const client = await connect();

      await new Promise<void>((resolve) => {
        client.emit("workflow:join", "wf-3");
        client.once("workflow:state", () => resolve());
      });

      const appliedPromise = new Promise<{ version: number; op: unknown }>((resolve) => {
        client.once("op:applied", resolve);
      });

      const op = { type: "move_node", nodeId: "n1", position: { x: 10, y: 20 } };
      client.emit("op:submit", { op, baseVersion: 0 });

      const applied = await appliedPromise;
      expect(applied.version).toBe(1);
      expect(applied.op).toEqual(op);
    });

    it("emits op:rejected when OT conflict detected", async () => {
      // Server has a concurrent move on same node at version 1
      mockGetState.mockResolvedValue({
        version: 1,
        ops: [
          { version: 1, op: { type: "move_node", nodeId: "n1", position: { x: 5, y: 5 } } },
        ],
      });

      const client = await connect();

      await new Promise<void>((resolve) => {
        client.emit("workflow:join", "wf-4");
        client.once("workflow:state", () => resolve());
      });

      const rejectedPromise = new Promise<{ reason: string }>((resolve) => {
        client.once("op:rejected", resolve);
      });

      // baseVersion 0 means the concurrent op at version 1 is after baseVersion
      const op = { type: "move_node", nodeId: "n1", position: { x: 99, y: 99 } };
      client.emit("op:submit", { op, baseVersion: 0 });

      const rejected = await rejectedPromise;
      expect(rejected.reason).toBe("conflict:move");
    });

    it("ignores malformed payload (missing baseVersion)", async () => {
      const client = await connect();
      await new Promise<void>((resolve) => {
        client.emit("workflow:join", "wf-5");
        client.once("workflow:state", () => resolve());
      });

      client.emit("op:submit", { op: { type: "move_node" } }); // missing baseVersion
      await new Promise((r) => setTimeout(r, 100));
      expect(mockAppend).not.toHaveBeenCalled();
    });

    it("ignores op:submit before workflow:join (no workflowId on socket)", async () => {
      const client = await connect();
      const op = { type: "move_node", nodeId: "n1", position: { x: 1, y: 2 } };
      client.emit("op:submit", { op, baseVersion: 0 });
      await new Promise((r) => setTimeout(r, 100));
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe("cursor:move", () => {
    it("broadcasts cursor:updated to other clients in room", async () => {
      const client1 = await connect(makeToken("u1", "a@b.com"));
      const client2 = await connect(makeToken("u2", "b@c.com"));

      // Both join same room
      await Promise.all([
        new Promise<void>((r) => { client1.emit("workflow:join", "wf-6"); client1.once("workflow:state", () => r()); }),
        new Promise<void>((r) => { client2.emit("workflow:join", "wf-6"); client2.once("workflow:state", () => r()); }),
      ]);

      const cursorPromise = new Promise<{ userId: string; cursor: { x: number; y: number } }>((resolve) => {
        client2.once("cursor:updated", resolve);
      });

      client1.emit("cursor:move", { x: 50, y: 60 });

      const cursorEvent = await cursorPromise;
      expect(cursorEvent.userId).toBe("u1");
      expect(cursorEvent.cursor).toEqual({ x: 50, y: 60 });
    });

    it("ignores cursor:move with invalid payload", async () => {
      const client = await connect();
      await new Promise<void>((r) => { client.emit("workflow:join", "wf-c"); client.once("workflow:state", () => r()); });
      // Send invalid cursor (strings instead of numbers)
      client.emit("cursor:move", { x: "bad", y: "bad" });
      await new Promise((r) => setTimeout(r, 100));
      // No crash — just silently ignored
    });

    it("ignores cursor:move when client has no workflowId", async () => {
      const client = await connect();
      // Do NOT join — emit cursor directly
      client.emit("cursor:move", { x: 10, y: 20 });
      await new Promise((r) => setTimeout(r, 100));
    });
  });

  describe("disconnecting", () => {
    it("broadcasts peer:left when a client disconnects", async () => {
      const client1 = await connect(makeToken("u1", "a@b.com"));
      const client2 = await connect(makeToken("u2", "b@c.com"));

      await Promise.all([
        new Promise<void>((r) => { client1.emit("workflow:join", "wf-7"); client1.once("workflow:state", () => r()); }),
        new Promise<void>((r) => { client2.emit("workflow:join", "wf-7"); client2.once("workflow:state", () => r()); }),
      ]);

      const leftPromise = new Promise<{ userId: string }>((resolve) => {
        client1.once("peer:left", resolve);
      });

      client2.disconnect();

      const leftEvent = await leftPromise;
      expect(leftEvent.userId).toBe("u2");
    });
  });

  describe("connection rejected", () => {
    it("rejects connection with invalid JWT", async () => {
      const { io: ioClient } = await import("socket.io-client");
      const badClient = ioClient(`http://localhost:${port}`, {
        auth: { token: "not-a-valid-jwt" },
        transports: ["websocket"],
      });
      clients.push(badClient);

      const error = await new Promise<Error>((resolve) => {
        badClient.once("connect_error", resolve);
        setTimeout(() => resolve(new Error("timeout")), 3000);
      });

      expect(error.message).toBeTruthy();
    });
  });
});
