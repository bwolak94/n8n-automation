import { TenantMemberModel } from "../tenants/TenantMember.model.js";
import type { TenantMemberRole } from "@automation-hub/shared";

export interface MemberRecord {
  userId: string;
  email: string;
  role: string;
  joinedAt: Date;
}

export class MembersRepository {
  async findAll(tenantId: string): Promise<MemberRecord[]> {
    const docs = await TenantMemberModel.find({ tenantId }).lean();
    return docs.map((d) => ({
      userId: d.userId,
      email: d.email,
      role: d.role,
      joinedAt: d.joinedAt,
    }));
  }

  async invite(tenantId: string, email: string, role: TenantMemberRole): Promise<MemberRecord> {
    const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const doc = await TenantMemberModel.create({ tenantId, userId, email, role });
    return { userId: doc.userId, email: doc.email, role: doc.role, joinedAt: doc.joinedAt };
  }

  async updateRole(tenantId: string, userId: string, role: TenantMemberRole): Promise<boolean> {
    const result = await TenantMemberModel.findOneAndUpdate(
      { tenantId, userId },
      { role },
      { new: true }
    ).lean();
    return result !== null;
  }

  async remove(tenantId: string, userId: string): Promise<boolean> {
    const result = await TenantMemberModel.deleteOne({ tenantId, userId });
    return result.deletedCount > 0;
  }
}
