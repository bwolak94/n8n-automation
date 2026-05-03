import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import { createSocketAuthMiddleware } from "../../modules/collaboration/socketAuth.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSocket(overrides: Partial<{
  token: string | undefined;
  authorizationHeader: string | undefined;
  tenantId: string | undefined;
  xTenantId: string | undefined;
}> = {}): { data: Record<string, unknown>; handshake: Record<string, unknown> } {
  const { token, authorizationHeader, tenantId, xTenantId } = overrides;
  return {
    data: {},
    handshake: {
      auth: {
        token,
        tenantId,
      },
      headers: {
        ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
        ...(xTenantId ? { "x-tenant-id": xTenantId } : {}),
      },
    },
  };
}

const SECRET = "test-secret-super-long-string-32ch";

function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, SECRET, { expiresIn: "1h" });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createSocketAuthMiddleware", () => {
  let middleware: ReturnType<typeof createSocketAuthMiddleware>;
  let next: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    middleware = createSocketAuthMiddleware();
    next = jest.fn();
  });

  it("calls next() with no error for a valid JWT in auth.token", () => {
    const token = signToken({ userId: "u1", email: "a@b.com" });
    const socket = makeSocket({ token });

    middleware(socket as never, next as never);

    expect(next).toHaveBeenCalledWith(/* no args */);
    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeUndefined();
    expect(socket.data.userId).toBe("u1");
    expect(socket.data.email).toBe("a@b.com");
  });

  it("calls next() with no error for a valid JWT in Authorization header", () => {
    const token = signToken({ userId: "u2", email: "b@c.com" });
    const socket = makeSocket({ authorizationHeader: `Bearer ${token}` });

    middleware(socket as never, next as never);

    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeUndefined();
    expect(socket.data.userId).toBe("u2");
  });

  it("stores tenantId from auth.tenantId", () => {
    const token = signToken({ userId: "u1", email: "a@b.com" });
    const socket = makeSocket({ token, tenantId: "tenant-abc" });

    middleware(socket as never, next as never);

    expect(socket.data.tenantId).toBe("tenant-abc");
  });

  it("stores tenantId from x-tenant-id header when auth.tenantId is missing", () => {
    const token = signToken({ userId: "u1", email: "a@b.com" });
    const socket = makeSocket({ token, xTenantId: "tenant-from-header" });

    middleware(socket as never, next as never);

    expect(socket.data.tenantId).toBe("tenant-from-header");
  });

  it("defaults tenantId to empty string when neither auth nor header has it", () => {
    const token = signToken({ userId: "u1", email: "a@b.com" });
    const socket = makeSocket({ token });

    middleware(socket as never, next as never);

    expect(socket.data.tenantId).toBe("");
  });

  it("calls next() with error when no token is provided", () => {
    const socket = makeSocket();

    middleware(socket as never, next as never);

    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("Missing authentication token");
  });

  it("calls next() with error for an expired token", () => {
    const token = jwt.sign(
      { userId: "u1", email: "a@b.com" },
      SECRET,
      { expiresIn: -1 }
    );
    const socket = makeSocket({ token });

    middleware(socket as never, next as never);

    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("Invalid or expired token");
  });

  it("calls next() with error for a token signed with wrong secret", () => {
    const token = jwt.sign({ userId: "u1", email: "a@b.com" }, "wrong-secret");
    const socket = makeSocket({ token });

    middleware(socket as never, next as never);

    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("Invalid or expired token");
  });

  it("calls next() with error for a token missing required payload fields", () => {
    const token = jwt.sign({ sub: "123" }, SECRET);
    const socket = makeSocket({ token });

    middleware(socket as never, next as never);

    const [arg] = (next as jest.Mock).mock.calls[0] as unknown[];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("Invalid token payload");
  });
});
