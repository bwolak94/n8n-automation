import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { TenantMemberRole } from "@automation-hub/shared";
import { TenantController } from "../../modules/tenants/TenantController.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { TenantService } from "../../modules/tenants/TenantService.js";

// ─── Mock TenantService ────────────────────────────────────────────────────────

function makeService(): jest.Mocked<TenantService> {
  return {
    getTenantWithMembers: jest.fn(),
    inviteMember: jest.fn(),
    claimInvite: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    createTenant: jest.fn(),
  } as unknown as jest.Mocked<TenantService>;
}

// ─── Request / response helpers ───────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    tenantId: "tenant-1",
    tenantRole: TenantMemberRole.ADMIN,
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): jest.Mocked<Response> {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    end: jest.fn(),
  } as unknown as jest.Mocked<Response>;
  // status().end() chaining
  (res.status as jest.MockedFunction<typeof res.status>).mockReturnValue(res);
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TenantController", () => {
  let service: jest.Mocked<TenantService>;
  let controller: TenantController;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    service = makeService();
    controller = new TenantController(service);
    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  // ── getMe ──────────────────────────────────────────────────────────────────

  describe("getMe", () => {
    it("returns 200 with tenant data", async () => {
      const tenantData = { tenantId: "tenant-1", name: "Acme", members: [] };
      (service.getTenantWithMembers as jest.MockedFunction<typeof service.getTenantWithMembers>)
        .mockResolvedValue(tenantData as never);

      const req = makeReq();
      const res = makeRes();

      await controller.getMe(req, res, mockNext);

      expect(service.getTenantWithMembers).toHaveBeenCalledWith("tenant-1");
      expect(res.json).toHaveBeenCalledWith(tenantData);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("forwards errors to next", async () => {
      const err = new NotFoundError("Tenant not found");
      (service.getTenantWithMembers as jest.MockedFunction<typeof service.getTenantWithMembers>)
        .mockRejectedValue(err);

      await controller.getMe(makeReq(), makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  // ── invite ─────────────────────────────────────────────────────────────────

  describe("invite", () => {
    it("returns 201 with invite token on success", async () => {
      (service.inviteMember as jest.MockedFunction<typeof service.inviteMember>)
        .mockResolvedValue("invite-token-xyz");

      const req = makeReq({ body: { email: "new@example.com", role: "editor" } });
      const res = makeRes();

      await controller.invite(req, res, mockNext);

      expect(service.inviteMember).toHaveBeenCalledWith(
        "tenant-1",
        TenantMemberRole.ADMIN,
        "new@example.com",
        TenantMemberRole.EDITOR
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ inviteToken: "invite-token-xyz" });
    });

    it("calls next with ValidationError on invalid email", async () => {
      const req = makeReq({ body: { email: "not-an-email", role: "editor" } });

      await controller.invite(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(service.inviteMember).not.toHaveBeenCalled();
    });

    it("calls next with ValidationError on missing body", async () => {
      const req = makeReq({ body: {} });

      await controller.invite(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it("forwards ForbiddenError from service to next", async () => {
      const err = new ForbiddenError("Cannot invite owner");
      (service.inviteMember as jest.MockedFunction<typeof service.inviteMember>)
        .mockRejectedValue(err);

      const req = makeReq({ body: { email: "new@example.com", role: "editor" } });

      await controller.invite(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  // ── claimInvite ────────────────────────────────────────────────────────────

  describe("claimInvite", () => {
    it("returns 201 with member on valid token", async () => {
      const member = { userId: "user-1", email: "new@example.com", role: TenantMemberRole.EDITOR };
      (service.claimInvite as jest.MockedFunction<typeof service.claimInvite>)
        .mockResolvedValue(member as never);

      const req = makeReq({ body: { token: "valid.jwt.token" } });
      const res = makeRes();

      await controller.claimInvite(req, res, mockNext);

      expect(service.claimInvite).toHaveBeenCalledWith("valid.jwt.token");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(member);
    });

    it("calls next with ValidationError when token is missing", async () => {
      const req = makeReq({ body: {} });

      await controller.claimInvite(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(service.claimInvite).not.toHaveBeenCalled();
    });

    it("forwards ValidationError from service (expired token) to next", async () => {
      const err = new ValidationError("Invite token expired");
      (service.claimInvite as jest.MockedFunction<typeof service.claimInvite>)
        .mockRejectedValue(err);

      const req = makeReq({ body: { token: "expired.token" } });

      await controller.claimInvite(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  // ── updateRole ─────────────────────────────────────────────────────────────

  describe("updateRole", () => {
    it("returns 204 on success", async () => {
      (service.updateMemberRole as jest.MockedFunction<typeof service.updateMemberRole>)
        .mockResolvedValue(undefined);

      const req = makeReq({
        body: { role: "editor" },
        params: { userId: "user-2" } as Record<string, string>,
      });
      const res = makeRes();

      await controller.updateRole(req, res, mockNext);

      expect(service.updateMemberRole).toHaveBeenCalledWith(
        "tenant-1",
        TenantMemberRole.ADMIN,
        "user-2",
        TenantMemberRole.EDITOR
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("calls next with ValidationError on invalid role", async () => {
      const req = makeReq({
        body: { role: "superadmin" },
        params: { userId: "user-2" } as Record<string, string>,
      });

      await controller.updateRole(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(service.updateMemberRole).not.toHaveBeenCalled();
    });

    it("forwards ForbiddenError from service to next", async () => {
      const err = new ForbiddenError("Cannot assign owner role");
      (service.updateMemberRole as jest.MockedFunction<typeof service.updateMemberRole>)
        .mockRejectedValue(err);

      const req = makeReq({
        body: { role: "owner" },
        params: { userId: "user-2" } as Record<string, string>,
      });

      await controller.updateRole(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe("removeMember", () => {
    it("returns 204 on success", async () => {
      (service.removeMember as jest.MockedFunction<typeof service.removeMember>)
        .mockResolvedValue(undefined);

      const req = makeReq({
        params: { userId: "user-2" } as Record<string, string>,
      });
      const res = makeRes();

      await controller.removeMember(req, res, mockNext);

      expect(service.removeMember).toHaveBeenCalledWith(
        "tenant-1",
        TenantMemberRole.ADMIN,
        "user-2"
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it("forwards errors from service to next", async () => {
      const err = new ForbiddenError("Cannot remove last owner");
      (service.removeMember as jest.MockedFunction<typeof service.removeMember>)
        .mockRejectedValue(err);

      const req = makeReq({
        params: { userId: "owner-1" } as Record<string, string>,
      });

      await controller.removeMember(req, makeRes(), mockNext);

      expect(mockNext).toHaveBeenCalledWith(err);
    });
  });
});
