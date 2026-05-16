import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { TenantMemberRole } from "@automation-hub/shared";
import { env } from "../../config/env.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../shared/errors/index.js";
import type {
  TenantRepository,
  TenantRecord,
  MemberRecord,
  TenantWithMembers,
  CreateTenantInput,
} from "./TenantRepository.js";

// ─── Invite token payload ─────────────────────────────────────────────────────

interface InviteTokenPayload {
  tenantId: string;
  email: string;
  role: TenantMemberRole;
  nonce: string;
}

// ─── RBAC helpers ─────────────────────────────────────────────────────────────

const ROLE_RANK: Record<TenantMemberRole, number> = {
  [TenantMemberRole.VIEWER]: 0,
  [TenantMemberRole.EDITOR]: 1,
  [TenantMemberRole.ADMIN]: 2,
  [TenantMemberRole.OWNER]: 3,
};

function roleRank(role: TenantMemberRole): number {
  return ROLE_RANK[role] ?? 0;
}

function canAssignRole(caller: TenantMemberRole, target: TenantMemberRole): boolean {
  // Admin cannot assign owner; owner can assign any role
  if (caller === TenantMemberRole.OWNER) return true;
  if (caller === TenantMemberRole.ADMIN) return target !== TenantMemberRole.OWNER;
  return false;
}

// ─── TenantService ────────────────────────────────────────────────────────────

export class TenantService {
  constructor(private readonly repo: TenantRepository) {}

  // ── Tenant lifecycle ────────────────────────────────────────────────────────

  async createTenant(
    input: CreateTenantInput,
    ownerId: string,
    ownerEmail: string
  ): Promise<TenantRecord> {
    const tenant = await this.repo.create(input);
    await this.repo.addMember(tenant.tenantId, ownerId, ownerEmail, TenantMemberRole.OWNER);
    await this.repo.incrementUsage(tenant.tenantId, "members");
    return tenant;
  }

  async getTenantWithMembers(tenantId: string): Promise<TenantWithMembers> {
    const tenant = await this.repo.findByTenantId(tenantId);
    if (!tenant) throw new NotFoundError(`Tenant '${tenantId}' not found`);
    const members = await this.repo.findMembers(tenantId);
    return { ...tenant, members };
  }

  // ── Invite flow ─────────────────────────────────────────────────────────────

  async inviteMember(
    tenantId: string,
    callerRole: TenantMemberRole,
    email: string,
    role: TenantMemberRole
  ): Promise<string> {
    // Only admin+ can invite
    if (roleRank(callerRole) < roleRank(TenantMemberRole.ADMIN)) {
      throw new ForbiddenError("Only admins and owners can invite members");
    }

    // Admins cannot invite owners
    if (!canAssignRole(callerRole, role)) {
      throw new ForbiddenError(`Role '${callerRole}' cannot assign role '${role}'`);
    }

    const payload: InviteTokenPayload = {
      tenantId,
      email,
      role,
      nonce: randomUUID(),
    };

    const token = jwt.sign(payload, env.INVITE_SECRET, { expiresIn: "48h" });
    return token;
  }

  async claimInvite(token: string): Promise<MemberRecord> {
    let payload: InviteTokenPayload;

    try {
      payload = jwt.verify(token, env.INVITE_SECRET) as InviteTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new ValidationError("Invite token has expired");
      }
      throw new ValidationError("Invalid invite token");
    }

    // Idempotency: if member already exists, token was already claimed
    const existing = await this.repo.findMemberByEmail(payload.tenantId, payload.email);
    if (existing) {
      throw new ValidationError("Invite has already been claimed");
    }

    const userId = randomUUID();
    const member = await this.repo.addMember(
      payload.tenantId,
      userId,
      payload.email,
      payload.role
    );
    await this.repo.incrementUsage(payload.tenantId, "members");
    return member;
  }

  // ── Role management ─────────────────────────────────────────────────────────

  async updateMemberRole(
    tenantId: string,
    callerRole: TenantMemberRole,
    userId: string,
    newRole: TenantMemberRole
  ): Promise<void> {
    if (!canAssignRole(callerRole, newRole)) {
      throw new ForbiddenError(
        `Role '${callerRole}' cannot assign role '${newRole}'`
      );
    }

    const updated = await this.repo.updateMemberRole(tenantId, userId, newRole);
    if (!updated) throw new NotFoundError(`Member '${userId}' not found`);
  }

  // ── Member removal ──────────────────────────────────────────────────────────

  async removeMember(
    tenantId: string,
    callerRole: TenantMemberRole,
    userId: string
  ): Promise<void> {
    // Only admin+ can remove members
    if (roleRank(callerRole) < roleRank(TenantMemberRole.ADMIN)) {
      throw new ForbiddenError("Only admins and owners can remove members");
    }

    // Cannot remove the last owner
    const targetMember = await this.repo.findMemberByUserId(tenantId, userId);
    if (targetMember?.role === TenantMemberRole.OWNER) {
      const ownerCount = await this.repo.countOwners(tenantId);
      if (ownerCount <= 1) {
        throw new ForbiddenError("Cannot remove the last owner of a tenant");
      }
    }

    const removed = await this.repo.removeMember(tenantId, userId);
    if (!removed) throw new NotFoundError(`Member '${userId}' not found`);
    await this.repo.decrementUsage(tenantId, "members");
  }
}
