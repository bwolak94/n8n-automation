import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { TenantMemberRole } from "@automation-hub/shared";
import { UnauthorizedError } from "../shared/errors/index.js";

// ── ESM mock setup (must precede dynamic import of module under test) ─────────
const mockFindOne = jest.fn();

jest.unstable_mockModule("../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: { findOne: mockFindOne },
}));

const { tenantContext } = await import(
  "../shared/middleware/tenantContext.js"
);

// ─────────────────────────────────────────────────────────────────────────────

describe("tenantContext middleware", () => {
  const mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  const mockRes = {} as Response;

  const makeReq = (tenantId?: string, userId?: string): Request =>
    ({
      headers: tenantId ? { "x-tenant-id": tenantId } : {},
      user: userId ? { userId, email: "alice@example.com" } : undefined,
    } as unknown as Request);

  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when req.user is not attached (authenticate skipped)", async () => {
    await tenantContext(makeReq(), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("returns 401 when X-Tenant-Id header is missing", async () => {
    await tenantContext(makeReq(undefined, "user-1"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("returns 401 when user is not a member of the tenant", async () => {
    mockFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await tenantContext(makeReq("tenant-1", "user-1"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("attaches tenantId and tenantRole for a valid tenant member", async () => {
    mockFindOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: TenantMemberRole.EDITOR,
      }),
    });

    const req = makeReq("tenant-1", "user-1");
    await tenantContext(req, mockRes, mockNext);

    expect(req.tenantId).toBe("tenant-1");
    expect(req.tenantRole).toBe(TenantMemberRole.EDITOR);
    expect(mockNext).toHaveBeenCalledWith(/* no args */);
  });

  it("passes database errors to next()", async () => {
    const dbError = new Error("DB connection lost");
    mockFindOne.mockReturnValue({ lean: jest.fn().mockRejectedValue(dbError) });

    await tenantContext(makeReq("tenant-1", "user-1"), mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(dbError);
  });
});
