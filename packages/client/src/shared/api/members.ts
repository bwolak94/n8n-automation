import { apiClient } from "./client.js";
import type { TenantMember, InviteMemberData } from "../types/index.js";

export async function fetchMembers(): Promise<{ items: TenantMember[]; total: number }> {
  return apiClient.get("members").json<{ items: TenantMember[]; total: number }>();
}

export async function inviteMember(data: InviteMemberData): Promise<TenantMember> {
  return apiClient.post("members/invite", { json: data }).json<TenantMember>();
}

export async function updateMemberRole(userId: string, role: string): Promise<void> {
  await apiClient.patch(`members/${userId}/role`, { json: { role } });
}

export async function removeMember(userId: string): Promise<void> {
  await apiClient.delete(`members/${userId}`);
}
