import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { TenantMemberRole } from "@automation-hub/shared";

// ─── ESM mocks ────────────────────────────────────────────────────────────────

const mockTenantFindOne = jest.fn();
const mockTenantCreate = jest.fn();
const mockTenantUpdateOne = jest.fn();

jest.unstable_mockModule("../../modules/tenants/Tenant.model.js", () => ({
  TenantModel: {
    findOne: mockTenantFindOne,
    create: mockTenantCreate,
    updateOne: mockTenantUpdateOne,
  },
}));

const mockMemberFind = jest.fn();
const mockMemberFindOne = jest.fn();
const mockMemberCreate = jest.fn();
const mockMemberFindOneAndUpdate = jest.fn();
const mockMemberDeleteOne = jest.fn();
const mockMemberCountDocuments = jest.fn();

jest.unstable_mockModule("../../modules/tenants/TenantMember.model.js", () => ({
  TenantMemberModel: {
    find: mockMemberFind,
    findOne: mockMemberFindOne,
    create: mockMemberCreate,
    findOneAndUpdate: mockMemberFindOneAndUpdate,
    deleteOne: mockMemberDeleteOne,
    countDocuments: mockMemberCountDocuments,
  },
}));

const { TenantRepository } = await import("../../modules/tenants/TenantRepository.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTenantDoc(overrides = {}) {
  return {
    tenantId: "t-1",
    name: "Acme",
    slug: "acme",
    plan: "free",
    usageThisMonth: { workflows: 0, executions: 0, aiTokens: 0, members: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMemberDoc(overrides = {}) {
  return {
    tenantId: "t-1",
    userId: "user-1",
    email: "alice@example.com",
    role: TenantMemberRole.EDITOR,
    joinedAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TenantRepository", () => {
  let repo: InstanceType<typeof TenantRepository>;

  beforeEach(() => {
    repo = new TenantRepository();
    jest.clearAllMocks();
  });

  // ── findByTenantId ─────────────────────────────────────────────────────────

  describe("findByTenantId", () => {
    it("returns mapped entity when found", async () => {
      const doc = makeTenantDoc();
      mockTenantFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });

      const result = await repo.findByTenantId("t-1");

      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe("t-1");
      expect(result?.name).toBe("Acme");
      expect(mockTenantFindOne).toHaveBeenCalledWith({ tenantId: "t-1" });
    });

    it("returns null when not found", async () => {
      mockTenantFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const result = await repo.findByTenantId("ghost");
      expect(result).toBeNull();
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    it("creates tenant with generated tenantId", async () => {
      const doc = makeTenantDoc();
      mockTenantCreate.mockResolvedValue(doc);

      const result = await repo.create({ name: "Acme", slug: "acme" });

      expect(mockTenantCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme", slug: "acme", plan: "free" })
      );
      expect(result.tenantId).toBe("t-1");
    });

    it("creates tenant with provided tenantId", async () => {
      const doc = makeTenantDoc({ tenantId: "custom-id" });
      mockTenantCreate.mockResolvedValue(doc);

      await repo.create({ tenantId: "custom-id", name: "Acme", slug: "acme" });

      expect(mockTenantCreate).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: "custom-id" })
      );
    });
  });

  // ── incrementUsage / decrementUsage ────────────────────────────────────────

  describe("incrementUsage", () => {
    it("calls updateOne with $inc on the given field", async () => {
      mockTenantUpdateOne.mockResolvedValue({});

      await repo.incrementUsage("t-1", "workflows");

      expect(mockTenantUpdateOne).toHaveBeenCalledWith(
        { tenantId: "t-1" },
        { $inc: { "usageThisMonth.workflows": 1 } }
      );
    });

    it("uses provided amount", async () => {
      mockTenantUpdateOne.mockResolvedValue({});

      await repo.incrementUsage("t-1", "executions", 5);

      expect(mockTenantUpdateOne).toHaveBeenCalledWith(
        { tenantId: "t-1" },
        { $inc: { "usageThisMonth.executions": 5 } }
      );
    });
  });

  describe("decrementUsage", () => {
    it("calls updateOne with negative $inc", async () => {
      mockTenantUpdateOne.mockResolvedValue({});

      await repo.decrementUsage("t-1", "members");

      expect(mockTenantUpdateOne).toHaveBeenCalledWith(
        { tenantId: "t-1" },
        { $inc: { "usageThisMonth.members": -1 } }
      );
    });
  });

  // ── findMembers ────────────────────────────────────────────────────────────

  describe("findMembers", () => {
    it("returns array of member records", async () => {
      const docs = [makeMemberDoc(), makeMemberDoc({ userId: "user-2", email: "bob@example.com" })];
      mockMemberFind.mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) });

      const result = await repo.findMembers("t-1");

      expect(result).toHaveLength(2);
      expect(result[0]?.userId).toBe("user-1");
      expect(result[1]?.userId).toBe("user-2");
    });

    it("returns empty array when no members", async () => {
      mockMemberFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
      const result = await repo.findMembers("t-1");
      expect(result).toHaveLength(0);
    });
  });

  // ── findMemberByEmail ──────────────────────────────────────────────────────

  describe("findMemberByEmail", () => {
    it("returns member when found", async () => {
      const doc = makeMemberDoc();
      mockMemberFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });

      const result = await repo.findMemberByEmail("t-1", "alice@example.com");
      expect(result?.email).toBe("alice@example.com");
    });

    it("returns null when not found", async () => {
      mockMemberFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const result = await repo.findMemberByEmail("t-1", "ghost@example.com");
      expect(result).toBeNull();
    });
  });

  // ── findMemberByUserId ─────────────────────────────────────────────────────

  describe("findMemberByUserId", () => {
    it("returns member when found", async () => {
      const doc = makeMemberDoc();
      mockMemberFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) });

      const result = await repo.findMemberByUserId("t-1", "user-1");
      expect(result?.userId).toBe("user-1");
    });

    it("returns null when not found", async () => {
      mockMemberFindOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const result = await repo.findMemberByUserId("t-1", "ghost");
      expect(result).toBeNull();
    });
  });

  // ── addMember ──────────────────────────────────────────────────────────────

  describe("addMember", () => {
    it("creates and returns member record", async () => {
      const doc = makeMemberDoc({ role: TenantMemberRole.OWNER });
      mockMemberCreate.mockResolvedValue(doc);

      const result = await repo.addMember("t-1", "user-1", "alice@example.com", TenantMemberRole.OWNER);

      expect(mockMemberCreate).toHaveBeenCalledWith({
        tenantId: "t-1",
        userId: "user-1",
        email: "alice@example.com",
        role: TenantMemberRole.OWNER,
      });
      expect(result.role).toBe(TenantMemberRole.OWNER);
    });
  });

  // ── updateMemberRole ───────────────────────────────────────────────────────

  describe("updateMemberRole", () => {
    it("returns true when member was updated", async () => {
      mockMemberFindOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ userId: "user-1" }),
      });

      const result = await repo.updateMemberRole("t-1", "user-1", TenantMemberRole.ADMIN);
      expect(result).toBe(true);
    });

    it("returns false when member not found", async () => {
      mockMemberFindOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await repo.updateMemberRole("t-1", "ghost", TenantMemberRole.ADMIN);
      expect(result).toBe(false);
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe("removeMember", () => {
    it("returns true when member was deleted", async () => {
      mockMemberDeleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await repo.removeMember("t-1", "user-1");
      expect(result).toBe(true);
    });

    it("returns false when member was not found", async () => {
      mockMemberDeleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await repo.removeMember("t-1", "ghost");
      expect(result).toBe(false);
    });
  });

  // ── countOwners ───────────────────────────────────────────────────────────

  describe("countOwners", () => {
    it("returns count of owners for tenant", async () => {
      mockMemberCountDocuments.mockResolvedValue(2);

      const count = await repo.countOwners("t-1");
      expect(count).toBe(2);
      expect(mockMemberCountDocuments).toHaveBeenCalledWith({
        tenantId: "t-1",
        role: TenantMemberRole.OWNER,
      });
    });
  });
});
