import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  fetchMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "../api/members.js";

export const MEMBERS_KEY = "members";

export function useMembersQuery() {
  return useQuery({
    queryKey: [MEMBERS_KEY],
    queryFn: fetchMembers,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY] }),
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY] }),
  });
}
