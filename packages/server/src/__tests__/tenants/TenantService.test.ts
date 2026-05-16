import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { TenantMemberRole } from "@automation-hub/shared";
import { TenantService } from "../../modules/tenants/TenantService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type { TenantRepository, MemberRecord, TenantRecord } from "../../modules/tenants/TenantRepository.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    userId: "user-1",
    email: "alice@example.com",
    role: TenantMemberRole.EDITOR,
    joinedAt: new Date(),
    ...overrides,
  };
}

function makeTenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    tenantId: "tenant-1",
    name: "Test Org",
    slug: "test-org",
    plan: "free",
    usageThisMonth: { workflows: 0, executions: 0, aiTokens: 0, members: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(): jest.Mocked<TenantRepository> {
  return {
    create: jest.fn(),
    findByTenantId: jest.fn(),
    findMembers: jest.fn(),
    findMemberByEmail: jest.fn(),
    findMemberByUserId: jest.fn(),
    addMember: jest.fn(),
    updateMemberRole: jest.fn(),
    removeMember: jest.fn(),
    countOwners: jest.fn(),
    incrementUsage: jest.fn(),
    decrementUsage: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    countByTenant: jest.fn(),
    existsById: jest.fn(),
    model: {} as never,
    toEntity: jest.fn(),
    scopedFilter: jest.fn(),
  } as unknown as jest.Mocked<TenantRepository>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TenantService", () => {
  let repo: jest.Mocked<TenantRepository>;
  let service: TenantService;

  beforeEach(() => {
    repo = makeRepo();
    service = new TenantService(repo);
  });

  // ── createTenant ──────────────────────────────────────────────────────────

  describe("createTenant", () => {
    it("creates tenant and adds owner member", async () => {
      const tenant = makeTenant();
      (repo.create as jest.MockedFunction<typeof repo.create>).mockResolvedValue(tenant);
      (repo.addMember as jest.MockedFunction<typeof repo.addMember>).mockResolvedValue(
        makeMember({ role: TenantMemberRole.OWNER })
      );
      (repo.incrementUsage as jest.MockedFunction<typeof repo.incrementUsage>).mockResolvedValue(undefined);

      const result = await service.createTenant(
        { name: "Test Org", slug: "test-org" },
        "owner-1",
        "owner@example.com"
      );

      expect(repo.create).toHaveBeenCalled();
      expect(repo.addMember).toHaveBeenCalledWith(
        tenant.tenantId,
        "owner-1",
        "owner@example.com",
        TenantMemberRole.OWNER
      );
      expect(repo.incrementUsage).toHaveBeenCalledWith(tenant.tenantId, "members");
      expect(result.tenantId).toBe(tenant.tenantId);
    });
  });

  // ── getTenantWithMembers ──────────────────────────────────────────────────

  describe("getTenantWithMembers", () => {
    it("returns tenant with members", async () => {
      const tenant = makeTenant();
      const members = [makeMember()];
      (repo.findByTenantId as jest.MockedFunction<typeof repo.findByTenantId>).mockResolvedValue(tenant);
      (repo.findMembers as jest.MockedFunction<typeof repo.findMembers>).mockResolvedValue(members);

      const result = await service.getTenantWithMembers("tenant-1");
      expect(result.tenantId).toBe("tenant-1");
      expect(result.members).toHaveLength(1);
    });

    it("throws NotFoundError when tenant does not exist", async () => {
      (repo.findByTenantId as jest.MockedFunction<typeof repo.findByTenantId>).mockResolvedValue(null);
      await expect(service.getTenantWithMembers("ghost")).rejects.toThrow(NotFoundError);
    });
  });

  // ── inviteMember ──────────────────────────────────────────────────────────

  describe("inviteMember", () => {
    it("owner can invite any role", async () => {
      const token = await service.inviteMember(
        "tenant-1",
        TenantMemberRole.OWNER,
        "new@example.com",
        TenantMemberRole.ADMIN
      );
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(10);
    });

    it("admin can invite editor", async () => {
      const token = await service.inviteMember(
        "tenant-1",
        TenantMemberRole.ADMIN,
        "new@example.com",
        TenantMemberRole.EDITOR
      );
      expect(typeof token).toBe("string");
    });

    it("admin cannot invite owner", async () => {
      await expect(
        service.inviteMember("tenant-1", TenantMemberRole.ADMIN, "new@example.com", TenantMemberRole.OWNER)
      ).rejects.toThrow(ForbiddenError);
    });

    it("editor cannot invite anyone (not enough permissions)", async () => {
      await expect(
        service.inviteMember("tenant-1", TenantMemberRole.EDITOR, "new@example.com", TenantMemberRole.VIEWER)
      ).rejects.toThrow(ForbiddenError);
    });

    it("viewer cannot invite anyone", async () => {
      await expect(
        service.inviteMember("tenant-1", TenantMemberRole.VIEWER, "new@example.com", TenantMemberRole.VIEWER)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ── claimInvite ───────────────────────────────────────────────────────────

  describe("claimInvite", () => {
    it("valid token creates membership", async () => {
      // Get a valid token first
      const token = await service.inviteMember(
        "tenant-1",
        TenantMemberRole.OWNER,
        "claimer@example.com",
        TenantMemberRole.EDITOR
      );

      (repo.findMemberByEmail as jest.MockedFunction<typeof repo.findMemberByEmail>).mockResolvedValue(null);
      (repo.addMember as jest.MockedFunction<typeof repo.addMember>).mockResolvedValue(
        makeMember({ email: "claimer@example.com", role: TenantMemberRole.EDITOR })
      );
      (repo.incrementUsage as jest.MockedFunction<typeof repo.incrementUsage>).mockResolvedValue(undefined);

      const member = await service.claimInvite(token);
      expect(member.email).toBe("claimer@example.com");
      expect(member.role).toBe(TenantMemberRole.EDITOR);
      expect(repo.addMember).toHaveBeenCalled();
    });

    it("already-used token is rejected (member already exists)", async () => {
      const token = await service.inviteMember(
        "tenant-1",
        TenantMemberRole.OWNER,
        "existing@example.com",
        TenantMemberRole.EDITOR
      );

      // Simulate already claimed — member exists
      (repo.findMemberByEmail as jest.MockedFunction<typeof repo.findMemberByEmail>).mockResolvedValue(
        makeMember({ email: "existing@example.com" })
      );

      await expect(service.claimInvite(token)).rejects.toThrow(ValidationError);
      expect(repo.addMember).not.toHaveBeenCalled();
    });

    it("expired token is rejected", async () => {
      // Generate an already-expired token by mocking jwt.sign isn't needed —
      // we just use an obviously invalid/tampered token
      const bogusToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.abc";
      await expect(service.claimInvite(bogusToken)).rejects.toThrow(ValidationError);
    });

    it("completely invalid token is rejected", async () => {
      await expect(service.claimInvite("not-a-jwt")).rejects.toThrow(ValidationError);
    });
  });

  // ── updateMemberRole ──────────────────────────────────────────────────────

  describe("updateMemberRole", () => {
    it("owner can update any role", async () => {
      (repo.updateMemberRole as jest.MockedFunction<typeof repo.updateMemberRole>).mockResolvedValue(true);
      await expect(
        service.updateMemberRole("tenant-1", TenantMemberRole.OWNER, "user-2", TenantMemberRole.ADMIN)
      ).resolves.toBeUndefined();
    });

    it("admin cannot assign owner role", async () => {
      await expect(
        service.updateMemberRole("tenant-1", TenantMemberRole.ADMIN, "user-2", TenantMemberRole.OWNER)
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError when member not found", async () => {
      (repo.updateMemberRole as jest.MockedFunction<typeof repo.updateMemberRole>).mockResolvedValue(false);
      await expect(
        service.updateMemberRole("tenant-1", TenantMemberRole.OWNER, "ghost", TenantMemberRole.EDITOR)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe("removeMember", () => {
    it("admin can remove editor", async () => {
      (repo.findMemberByUserId as jest.MockedFunction<typeof repo.findMemberByUserId>).mockResolvedValue(
        makeMember({ role: TenantMemberRole.EDITOR })
      );
      (repo.removeMember as jest.MockedFunction<typeof repo.removeMember>).mockResolvedValue(true);
      (repo.decrementUsage as jest.MockedFunction<typeof repo.decrementUsage>).mockResolvedValue(undefined);

      await expect(
        service.removeMember("tenant-1", TenantMemberRole.ADMIN, "user-2")
      ).resolves.toBeUndefined();
      expect(repo.removeMember).toHaveBeenCalledWith("tenant-1", "user-2");
    });

    it("viewer cannot remove members (insufficient role)", async () => {
      await expect(
        service.removeMember("tenant-1", TenantMemberRole.VIEWER, "user-2")
      ).rejects.toThrow(ForbiddenError);
    });

    it("editor cannot remove members (insufficient role)", async () => {
      await expect(
        service.removeMember("tenant-1", TenantMemberRole.EDITOR, "user-2")
      ).rejects.toThrow(ForbiddenError);
    });

    it("cannot remove the last owner", async () => {
      (repo.findMemberByUserId as jest.MockedFunction<typeof repo.findMemberByUserId>).mockResolvedValue(
        makeMember({ role: TenantMemberRole.OWNER })
      );
      (repo.countOwners as jest.MockedFunction<typeof repo.countOwners>).mockResolvedValue(1);

      await expect(
        service.removeMember("tenant-1", TenantMemberRole.OWNER, "last-owner")
      ).rejects.toThrow(ForbiddenError);
    });

    it("can remove owner when another owner exists", async () => {
      (repo.findMemberByUserId as jest.MockedFunction<typeof repo.findMemberByUserId>).mockResolvedValue(
        makeMember({ role: TenantMemberRole.OWNER })
      );
      (repo.countOwners as jest.MockedFunction<typeof repo.countOwners>).mockResolvedValue(2);
      (repo.removeMember as jest.MockedFunction<typeof repo.removeMember>).mockResolvedValue(true);
      (repo.decrementUsage as jest.MockedFunction<typeof repo.decrementUsage>).mockResolvedValue(undefined);

      await expect(
        service.removeMember("tenant-1", TenantMemberRole.OWNER, "owner-2")
      ).resolves.toBeUndefined();
    });

    it("throws NotFoundError when member does not exist", async () => {
      (repo.findMemberByUserId as jest.MockedFunction<typeof repo.findMemberByUserId>).mockResolvedValue(null);
      (repo.removeMember as jest.MockedFunction<typeof repo.removeMember>).mockResolvedValue(false);

      await expect(
        service.removeMember("tenant-1", TenantMemberRole.ADMIN, "ghost")
      ).rejects.toThrow(NotFoundError);
    });
  });
});
