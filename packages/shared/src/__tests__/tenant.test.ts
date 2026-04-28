import { expectTypeOf } from "expect-type";
import {
  TenantSchema,
  TenantMemberSchema,
  InviteMemberSchema,
  CreateTenantSchema,
} from "../schemas/tenant.js";
import { Plan, TenantMemberRole } from "../constants/index.js";
import type { Tenant, TenantMember } from "../types/index.js";

const validTenant = {
  id: "tenant-1",
  name: "Acme Corp",
  slug: "acme-corp",
  plan: Plan.FREE,
  maxWorkflows: 5,
  maxExecutionsPerMonth: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validMember = {
  id: "member-1",
  tenantId: "tenant-1",
  userId: "user-1",
  email: "alice@example.com",
  role: TenantMemberRole.EDITOR,
  joinedAt: new Date(),
};

describe("TenantSchema", () => {
  it("parses valid tenant", () => {
    expect(TenantSchema.safeParse(validTenant).success).toBe(true);
  });

  it("rejects invalid slug (uppercase)", () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: "Acme-Corp" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("slug");
  });

  it("rejects slug with special chars", () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: "acme_corp" });
    expect(result.success).toBe(false);
  });

  it("accepts slug with numbers", () => {
    const result = TenantSchema.safeParse({ ...validTenant, slug: "acme-123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid plan", () => {
    const result = TenantSchema.safeParse({ ...validTenant, plan: "invalid" });
    expect(result.success).toBe(false);
  });

  it("inferred Tenant type has correct shape", () => {
    expectTypeOf<Tenant>().toHaveProperty("id");
    expectTypeOf<Tenant>().toHaveProperty("slug");
    expectTypeOf<Tenant>().toHaveProperty("plan");
  });
});

describe("TenantMemberSchema", () => {
  it("parses valid member", () => {
    expect(TenantMemberSchema.safeParse(validMember).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("email");
  });

  it("rejects invalid role", () => {
    const result = TenantMemberSchema.safeParse({ ...validMember, role: "superadmin" });
    expect(result.success).toBe(false);
  });

  it("inferred TenantMember type has correct shape", () => {
    expectTypeOf<TenantMember>().toHaveProperty("tenantId");
    expectTypeOf<TenantMember>().toHaveProperty("email");
    expectTypeOf<TenantMember>().toHaveProperty("role");
  });
});

describe("InviteMemberSchema", () => {
  it("parses valid invite", () => {
    const result = InviteMemberSchema.safeParse({ email: "bob@example.com" });
    expect(result.success).toBe(true);
  });

  it("defaults role to editor", () => {
    const result = InviteMemberSchema.safeParse({ email: "bob@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe(TenantMemberRole.EDITOR);
    }
  });

  it("accepts explicit role", () => {
    const result = InviteMemberSchema.safeParse({
      email: "bob@example.com",
      role: TenantMemberRole.ADMIN,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe(TenantMemberRole.ADMIN);
    }
  });

  it("rejects invalid email", () => {
    const result = InviteMemberSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
  });
});

describe("CreateTenantSchema", () => {
  it("defaults plan to free and maxWorkflows to 5", () => {
    const result = CreateTenantSchema.safeParse({ name: "Test", slug: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plan).toBe(Plan.FREE);
      expect(result.data.maxWorkflows).toBe(5);
      expect(result.data.maxExecutionsPerMonth).toBe(100);
    }
  });
});
