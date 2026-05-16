import type { Model } from "mongoose";
import { randomUUID } from "node:crypto";
import { Plan, TenantMemberRole } from "@automation-hub/shared";
import { BaseRepository } from "./BaseRepository.js";
import { TenantModel, type ITenant, type UsageThisMonth } from "./Tenant.model.js";
import { TenantMemberModel } from "./TenantMember.model.js";

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface TenantRecord {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  usageThisMonth: UsageThisMonth;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberRecord {
  userId: string;
  email: string;
  role: TenantMemberRole;
  joinedAt: Date;
}

export interface TenantWithMembers extends TenantRecord {
  members: MemberRecord[];
}

export interface CreateTenantInput {
  tenantId?: string;
  name: string;
  slug: string;
  plan?: string;
}

export type UsageField = keyof UsageThisMonth;

// ─── Lean doc type for Tenant ─────────────────────────────────────────────────

interface TenantLeanDoc {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
  usageThisMonth: UsageThisMonth;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Lean doc type for Member ─────────────────────────────────────────────────

interface MemberLeanDoc {
  tenantId: string;
  userId: string;
  email: string;
  role: TenantMemberRole;
  joinedAt: Date;
}

// ─── TenantRepository ─────────────────────────────────────────────────────────

export class TenantRepository extends BaseRepository<TenantLeanDoc & { tenantId: string }, TenantRecord> {
  protected readonly model = TenantModel as unknown as Model<TenantLeanDoc & { tenantId: string }>;

  protected toEntity(doc: TenantLeanDoc): TenantRecord {
    return {
      tenantId: doc.tenantId,
      name: doc.name,
      slug: doc.slug,
      plan: doc.plan,
      usageThisMonth: doc.usageThisMonth,
      stripeCustomerId: doc.stripeCustomerId,
      stripeSubscriptionId: doc.stripeSubscriptionId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // ── Tenant CRUD ─────────────────────────────────────────────────────────────

  async findByTenantId(tenantId: string): Promise<TenantRecord | null> {
    const doc = await (TenantModel.findOne({ tenantId }) as unknown as {
      lean(): Promise<TenantLeanDoc | null>;
    }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(input: CreateTenantInput): Promise<TenantRecord> {
    const doc = await TenantModel.create({
      tenantId: input.tenantId ?? randomUUID(),
      name: input.name,
      slug: input.slug,
      plan: input.plan ?? Plan.FREE,
    }) as unknown as TenantLeanDoc;
    return this.toEntity(doc);
  }

  async incrementUsage(
    tenantId: string,
    field: UsageField,
    amount = 1
  ): Promise<void> {
    await TenantModel.updateOne(
      { tenantId },
      { $inc: { [`usageThisMonth.${field}`]: amount } }
    );
  }

  async decrementUsage(
    tenantId: string,
    field: UsageField,
    amount = 1
  ): Promise<void> {
    await TenantModel.updateOne(
      { tenantId },
      { $inc: { [`usageThisMonth.${field}`]: -amount } }
    );
  }

  // ── Member operations ───────────────────────────────────────────────────────

  async findMembers(tenantId: string): Promise<MemberRecord[]> {
    const docs = await (TenantMemberModel.find({ tenantId }) as unknown as {
      lean(): Promise<MemberLeanDoc[]>;
    }).lean();
    return docs.map(this.toMemberRecord);
  }

  async findMemberByEmail(
    tenantId: string,
    email: string
  ): Promise<MemberRecord | null> {
    const doc = await (TenantMemberModel.findOne({ tenantId, email }) as unknown as {
      lean(): Promise<MemberLeanDoc | null>;
    }).lean();
    return doc ? this.toMemberRecord(doc) : null;
  }

  async findMemberByUserId(
    tenantId: string,
    userId: string
  ): Promise<MemberRecord | null> {
    const doc = await (TenantMemberModel.findOne({ tenantId, userId }) as unknown as {
      lean(): Promise<MemberLeanDoc | null>;
    }).lean();
    return doc ? this.toMemberRecord(doc) : null;
  }

  async addMember(
    tenantId: string,
    userId: string,
    email: string,
    role: TenantMemberRole
  ): Promise<MemberRecord> {
    const doc = await TenantMemberModel.create({ tenantId, userId, email, role }) as unknown as MemberLeanDoc;
    return this.toMemberRecord(doc);
  }

  async updateMemberRole(
    tenantId: string,
    userId: string,
    role: TenantMemberRole
  ): Promise<boolean> {
    const result = await TenantMemberModel.findOneAndUpdate(
      { tenantId, userId },
      { role },
      { new: true }
    ).lean();
    return result !== null;
  }

  async removeMember(tenantId: string, userId: string): Promise<boolean> {
    const result = await TenantMemberModel.deleteOne({ tenantId, userId });
    return result.deletedCount > 0;
  }

  async countOwners(tenantId: string): Promise<number> {
    return TenantMemberModel.countDocuments({
      tenantId,
      role: TenantMemberRole.OWNER,
    }) as unknown as Promise<number>;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private toMemberRecord(doc: MemberLeanDoc): MemberRecord {
    return {
      userId: doc.userId,
      email: doc.email,
      role: doc.role,
      joinedAt: doc.joinedAt,
    };
  }
}
