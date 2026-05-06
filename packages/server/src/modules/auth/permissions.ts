// ─── Permission catalogue ─────────────────────────────────────────────────────

export const PERMISSIONS = [
  "workflow:create",
  "workflow:read",
  "workflow:update",
  "workflow:delete",
  "workflow:execute",
  "credential:create",
  "credential:read",
  "credential:delete",
  "member:invite",
  "member:remove",
  "member:changeRole",
  "execution:read",
  "execution:cancel",
  "billing:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// ─── Built-in role permission sets ────────────────────────────────────────────

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p !== "billing:manage"
);

const EDITOR_PERMISSIONS: Permission[] = [
  "workflow:create",
  "workflow:read",
  "workflow:update",
  "workflow:delete",
  "workflow:execute",
  "credential:read",
  "execution:read",
  "execution:cancel",
];

const VIEWER_PERMISSIONS: Permission[] = [
  "workflow:read",
  "execution:read",
];

export const ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> = {
  owner:  ALL_PERMISSIONS,
  admin:  ADMIN_PERMISSIONS,
  editor: EDITOR_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

// ─── Permission check ─────────────────────────────────────────────────────────

/**
 * Returns true when the given role (plus any custom permission overrides) grants
 * the requested permission.
 *
 * Resolution order:
 *   1. Owner always has every permission — cannot be restricted.
 *   2. If customPermissions is non-empty, use it exclusively (overrides the role).
 *   3. Otherwise, use the built-in ROLE_PERMISSIONS map.
 */
export function hasPermission(
  role: string,
  customPermissions: readonly string[] | undefined,
  permission: Permission
): boolean {
  if (role === "owner") return true;

  if (customPermissions && customPermissions.length > 0) {
    return customPermissions.includes(permission);
  }

  const rolePerms = ROLE_PERMISSIONS[role] ?? [];
  return (rolePerms as readonly string[]).includes(permission);
}
