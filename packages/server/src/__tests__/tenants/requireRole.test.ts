import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { TenantMemberRole } from "@automation-hub/shared";
import { requireRole } from "../../shared/middleware/requireRole.js";
import { ForbiddenError } from "../../shared/errors/index.js";

function makeReq(role?: TenantMemberRole): Request {
  return { tenantRole: role } as unknown as Request;
}

const mockRes = {} as Response;

describe("requireRole middleware", () => {
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  describe("owner", () => {
    it("passes all role checks", () => {
      const req = makeReq(TenantMemberRole.OWNER);
      for (const role of Object.values(TenantMemberRole)) {
        mockNext.mockClear();
        requireRole(role)(req, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(/* no args */);
      }
    });
  });

  describe("admin", () => {
    it("passes admin, editor, viewer checks", () => {
      const req = makeReq(TenantMemberRole.ADMIN);
      for (const role of [TenantMemberRole.ADMIN, TenantMemberRole.EDITOR, TenantMemberRole.VIEWER]) {
        mockNext.mockClear();
        requireRole(role)(req, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(/* no args */);
      }
    });

    it("is blocked from owner-only endpoints", () => {
      const req = makeReq(TenantMemberRole.ADMIN);
      requireRole(TenantMemberRole.OWNER)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe("editor", () => {
    it("passes viewer and editor checks", () => {
      const req = makeReq(TenantMemberRole.EDITOR);
      for (const role of [TenantMemberRole.VIEWER, TenantMemberRole.EDITOR]) {
        mockNext.mockClear();
        requireRole(role)(req, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledWith(/* no args */);
      }
    });

    it("is blocked on admin-required endpoints", () => {
      const req = makeReq(TenantMemberRole.EDITOR);
      requireRole(TenantMemberRole.ADMIN)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("is blocked on owner-required endpoints", () => {
      const req = makeReq(TenantMemberRole.EDITOR);
      requireRole(TenantMemberRole.OWNER)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe("viewer", () => {
    it("passes viewer check", () => {
      const req = makeReq(TenantMemberRole.VIEWER);
      requireRole(TenantMemberRole.VIEWER)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(/* no args */);
    });

    it("is blocked on editor-required endpoints (mutating)", () => {
      const req = makeReq(TenantMemberRole.VIEWER);
      requireRole(TenantMemberRole.EDITOR)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });

    it("is blocked on admin-required endpoints (member management)", () => {
      const req = makeReq(TenantMemberRole.VIEWER);
      requireRole(TenantMemberRole.ADMIN)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe("missing role", () => {
    it("returns 403 when tenantRole is undefined", () => {
      const req = makeReq(undefined);
      requireRole(TenantMemberRole.VIEWER)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    });
  });

  describe("403 error details", () => {
    it("error message mentions required role", () => {
      const req = makeReq(TenantMemberRole.VIEWER);
      requireRole(TenantMemberRole.ADMIN)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("admin") })
      );
    });

    it("error has 403 status code", () => {
      const req = makeReq(TenantMemberRole.VIEWER);
      requireRole(TenantMemberRole.ADMIN)(req, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });
});
