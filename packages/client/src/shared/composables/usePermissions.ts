import { computed } from "vue";
import { useAuthStore } from "../../stores/authStore.js";

// ─── Permission catalogue (mirrors server permissions.ts) ─────────────────────

type Permission =
  | "workflow:create"
  | "workflow:read"
  | "workflow:update"
  | "workflow:delete"
  | "workflow:execute"
  | "credential:create"
  | "credential:read"
  | "credential:delete"
  | "member:invite"
  | "member:remove"
  | "member:changeRole"
  | "execution:read"
  | "execution:cancel"
  | "billing:manage"
  | "settings:manage";

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  owner: [
    "workflow:create", "workflow:read", "workflow:update", "workflow:delete", "workflow:execute",
    "credential:create", "credential:read", "credential:delete",
    "member:invite", "member:remove", "member:changeRole",
    "execution:read", "execution:cancel",
    "billing:manage", "settings:manage",
  ],
  admin: [
    "workflow:create", "workflow:read", "workflow:update", "workflow:delete", "workflow:execute",
    "credential:create", "credential:read", "credential:delete",
    "member:invite", "member:remove", "member:changeRole",
    "execution:read", "execution:cancel",
    "settings:manage",
  ],
  editor: [
    "workflow:create", "workflow:read", "workflow:update", "workflow:delete", "workflow:execute",
    "credential:read",
    "execution:read", "execution:cancel",
  ],
  viewer: [
    "workflow:read",
    "execution:read",
  ],
};

function hasPermission(role: string, permission: Permission): boolean {
  if (role === "owner") return true;
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return (perms as readonly string[]).includes(permission);
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function usePermissions() {
  const authStore = useAuthStore();

  const role = computed(() => authStore.user?.role ?? "viewer");

  function canDo(permission: Permission): boolean {
    return hasPermission(role.value, permission);
  }

  const can = {
    createWorkflow:   computed(() => canDo("workflow:create")),
    readWorkflow:     computed(() => canDo("workflow:read")),
    updateWorkflow:   computed(() => canDo("workflow:update")),
    deleteWorkflow:   computed(() => canDo("workflow:delete")),
    executeWorkflow:  computed(() => canDo("workflow:execute")),
    createCredential: computed(() => canDo("credential:create")),
    readCredential:   computed(() => canDo("credential:read")),
    deleteCredential: computed(() => canDo("credential:delete")),
    inviteMember:     computed(() => canDo("member:invite")),
    removeMember:     computed(() => canDo("member:remove")),
    changeRole:       computed(() => canDo("member:changeRole")),
    readExecution:    computed(() => canDo("execution:read")),
    cancelExecution:  computed(() => canDo("execution:cancel")),
    manageBilling:    computed(() => canDo("billing:manage")),
    manageSettings:   computed(() => canDo("settings:manage")),
  };

  return { canDo, can, role };
}
