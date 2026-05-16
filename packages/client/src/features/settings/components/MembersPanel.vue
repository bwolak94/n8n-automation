<script setup lang="ts">
import { ref, computed } from "vue";
import { z } from "zod";
import { useTenantStore } from "../../../stores/tenantStore.js";
import {
  useMembersQuery,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "../../../shared/queries/useMembers.js";

const tenantStore = useTenantStore();
const { data, isPending: isLoadingMembers } = useMembersQuery();
const { mutate: inviteMember, isPending: isInviting } = useInviteMember();
const { mutate: updateRole } = useUpdateMemberRole();
const { mutate: removeMember } = useRemoveMember();

// ── Invite form ───────────────────────────────────────────────────────────────

const inviteEmail = ref("");
const inviteRole = ref<"admin" | "editor" | "viewer">("editor");
const inviteError = ref<string | null>(null);

const emailSchema = z.string().email("Invalid email address");

// Owners can assign any role; admins cannot assign owner
const availableRoles = computed(() => {
  if (tenantStore.isOwner) return ["owner", "admin", "editor", "viewer"] as const;
  return ["admin", "editor", "viewer"] as const;
});

function handleInvite(): void {
  inviteError.value = null;
  const result = emailSchema.safeParse(inviteEmail.value.trim());
  if (!result.success) {
    inviteError.value = result.error.errors[0]?.message ?? "Invalid email";
    return;
  }
  inviteMember(
    { email: inviteEmail.value.trim(), role: inviteRole.value },
    {
      onSuccess: () => {
        inviteEmail.value = "";
        inviteError.value = null;
      },
      onError: () => {
        inviteError.value = "Failed to invite member. Try again.";
      },
    }
  );
}

function handleRoleChange(userId: string, role: string): void {
  updateRole({ userId, role });
}

function handleRemove(userId: string): void {
  if (!confirm("Remove this member from the organisation?")) return;
  removeMember(userId);
}

const canManageMembers = computed(() => tenantStore.isAdmin);
</script>

<template>
  <section data-testid="members-panel">
    <h2 class="mb-5 text-base font-semibold text-gray-800">Team Members</h2>

    <!-- Invite form (admin/owner only) -->
    <div
      v-if="canManageMembers"
      class="mb-6 rounded-xl border border-gray-200 bg-white p-5"
      data-testid="invite-form"
    >
      <h3 class="mb-3 text-sm font-semibold text-gray-700">Invite Member</h3>
      <div class="flex gap-2">
        <div class="flex-1">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="colleague@company.com"
            class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            :class="inviteError ? 'border-red-300 focus:border-red-400' : 'border-gray-300 focus:border-violet-400'"
            data-testid="invite-email-input"
            @keydown.enter="handleInvite"
          />
          <p v-if="inviteError" class="mt-1 text-xs text-red-500" data-testid="invite-error">
            {{ inviteError }}
          </p>
        </div>
        <select
          v-model="inviteRole"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          data-testid="invite-role-select"
        >
          <option v-for="role in availableRoles" :key="role" :value="role" class="capitalize">
            {{ role }}
          </option>
        </select>
        <button
          type="button"
          class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          :disabled="isInviting"
          data-testid="invite-submit-btn"
          @click="handleInvite"
        >
          {{ isInviting ? "Inviting…" : "Invite" }}
        </button>
      </div>
    </div>

    <!-- Member list -->
    <div class="rounded-xl border border-gray-200 bg-white" data-testid="members-list">
      <!-- Loading -->
      <div v-if="isLoadingMembers" class="space-y-3 p-5">
        <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded bg-gray-100" />
      </div>

      <!-- Empty -->
      <div v-else-if="!data?.items?.length" class="p-8 text-center">
        <p class="text-sm text-gray-400">No members yet.</p>
      </div>

      <!-- Table -->
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th class="px-5 py-2.5">Email</th>
            <th class="px-5 py-2.5">Role</th>
            <th class="px-5 py-2.5">Joined</th>
            <th v-if="canManageMembers" class="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in data.items"
            :key="member.userId"
            class="border-b border-gray-50 last:border-none"
            data-testid="member-row"
          >
            <td class="px-5 py-3 font-medium text-gray-800">{{ member.email }}</td>
            <td class="px-5 py-3">
              <!-- Role selector for admins/owners -->
              <select
                v-if="canManageMembers"
                :value="member.role"
                class="rounded border border-gray-200 px-2 py-1 text-xs capitalize focus:border-violet-400 focus:outline-none"
                :data-testid="`role-select-${member.userId}`"
                @change="handleRoleChange(member.userId, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="role in availableRoles" :key="role" :value="role" class="capitalize">
                  {{ role }}
                </option>
              </select>
              <!-- Viewer: just display -->
              <span v-else class="capitalize text-gray-600">{{ member.role }}</span>
            </td>
            <td class="px-5 py-3 text-gray-400 text-xs">
              {{ new Date(member.joinedAt).toLocaleDateString() }}
            </td>
            <td v-if="canManageMembers" class="px-5 py-3">
              <button
                type="button"
                class="text-xs text-red-400 hover:text-red-600"
                :data-testid="`remove-member-${member.userId}`"
                @click="handleRemove(member.userId)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
