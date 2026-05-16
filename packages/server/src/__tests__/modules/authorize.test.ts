import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { authorize } from "../../shared/middleware/authorize.js";
import { ForbiddenError } from "../../shared/errors/index.js";
import type { TenantMemberRole } from "@automation-hub/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(role?: string, customPermissions?: string[]): Request {
  return {
    tenantRole: role as TenantMemberRole | undefined,
    tenantCustomPermissions: customPermissions,
  } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function captureNext(): { next: NextFunction; error: unknown } {
  const captured: { error: unknown } = { error: undefined };
  const next = jest.fn((err?: unknown) => {
    captured.error = err;
  }) as unknown as NextFunction;
  return { next, error: captured };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authorize middleware", () => {
  it("calls next() when role has the required permission", () => {
    const guard = authorize("workflow:create");
    const { next } = captureNext();
    guard(makeReq("editor"), makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it("calls next(ForbiddenError) when role lacks the permission", () => {
    const guard = authorize("billing:manage");
    const { next, error } = captureNext();
    guard(makeReq("editor"), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect((error as { error: unknown }).error ?? next.mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });

  it("owner always passes regardless of permission", () => {
    const guard = authorize("billing:manage");
    const { next } = captureNext();
    guard(makeReq("owner"), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("viewer is denied workflow:create", () => {
    const guard = authorize("workflow:create");
    const { next } = captureNext();
    guard(makeReq("viewer"), makeRes(), next);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("viewer is allowed workflow:read", () => {
    const guard = authorize("workflow:read");
    const { next } = captureNext();
    guard(makeReq("viewer"), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next(ForbiddenError) when tenantRole is missing", () => {
    const guard = authorize("workflow:read");
    const { next } = captureNext();
    guard(makeReq(undefined), makeRes(), next);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("customPermissions grant a permission not in the role", () => {
    // viewer normally cannot credential:create
    const guard = authorize("credential:create");
    const { next } = captureNext();
    guard(makeReq("viewer", ["credential:create", "workflow:read"]), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("customPermissions deny a permission that the role would allow", () => {
    // admin normally has member:invite, but custom permissions override to empty-ish set
    const guard = authorize("member:invite");
    const { next } = captureNext();
    guard(makeReq("admin", ["workflow:read"]), makeRes(), next);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("empty customPermissions array falls back to role", () => {
    // admin has member:invite in ROLE_PERMISSIONS; empty custom should fall through
    const guard = authorize("member:invite");
    const { next } = captureNext();
    guard(makeReq("admin", []), makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("ForbiddenError message includes the permission name", () => {
    const guard = authorize("billing:manage");
    const { next } = captureNext();
    guard(makeReq("editor"), makeRes(), next);
    const err = next.mock.calls[0]?.[0] as ForbiddenError;
    expect(err.message).toContain("billing:manage");
  });
});
