import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { env } from "../../config/env.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface JwtPayload {
  userId: string;
  email: string;
}

function isJwtPayload(payload: unknown): payload is JwtPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "userId" in payload &&
    "email" in payload &&
    typeof (payload as Record<string, unknown>).userId === "string" &&
    typeof (payload as Record<string, unknown>).email === "string"
  );
}

// ─── Middleware factory ───────────────────────────────────────────────────────

export function createSocketAuthMiddleware() {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const authData = socket.handshake.auth as Record<string, unknown>;

    const token =
      (authData["token"] as string | undefined) ??
      (socket.handshake.headers["authorization"] as string | undefined)?.replace(
        "Bearer ",
        ""
      );

    if (!token) {
      next(new Error("Missing authentication token"));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (!isJwtPayload(payload)) {
        next(new Error("Invalid token payload"));
        return;
      }

      socket.data.userId = payload.userId;
      socket.data.email = payload.email;

      // Tenant from handshake auth or header
      const tenantId =
        (authData["tenantId"] as string | undefined) ??
        (socket.handshake.headers["x-tenant-id"] as string | undefined) ??
        "";
      socket.data.tenantId = tenantId;

      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  };
}
