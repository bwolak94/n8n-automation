import { describe, expect, it } from "@jest/globals";
import {
  hasPermission,
  ROLE_PERMISSIONS,
  type Permission,
} from "../../modules/auth/permissions.js";

// ─── ROLE_PERMISSIONS catalogue ───────────────────────────────────────────────

describe("ROLE_PERMISSIONS", () => {
  it("owner has all permissions", () => {
    const ownerPerms = ROLE_PERMISSIONS["owner"];
    expect(ownerPerms).toContain("workflow:create");
    expect(ownerPerms).toContain("billing:manage");
    expect(ownerPerms).toContain("settings:manage");
  });

  it("admin has all permissions except billing:manage", () => {
    const adminPerms = ROLE_PERMISSIONS["admin"];
    expect(adminPerms).not.toContain("billing:manage");
    expect(adminPerms).toContain("workflow:create");
    expect(adminPerms).toContain("settings:manage");
  });

  it("editor has workflow + execution + credential:read permissions", () => {
    const perms = ROLE_PERMISSIONS["editor"] as readonly string[];
    expect(perms).toContain("workflow:create");
    expect(perms).toContain("workflow:read");
    expect(perms).toContain("workflow:update");
    expect(perms).toContain("workflow:delete");
    expect(perms).toContain("workflow:execute");
    expect(perms).toContain("credential:read");
    expect(perms).toContain("execution:read");
    expect(perms).toContain("execution:cancel");
  });

  it("editor cannot manage billing or settings or members", () => {
    const perms = ROLE_PERMISSIONS["editor"] as readonly string[];
    expect(perms).not.toContain("billing:manage");
    expect(perms).not.toContain("settings:manage");
    expect(perms).not.toContain("member:invite");
    expect(perms).not.toContain("member:remove");
    expect(perms).not.toContain("member:changeRole");
  });

  it("viewer can only read workflows and executions", () => {
    const perms = ROLE_PERMISSIONS["viewer"] as readonly string[];
    expect(perms).toContain("workflow:read");
    expect(perms).toContain("execution:read");
    expect(perms).toHaveLength(2);
  });
});

// ─── hasPermission — owner bypass ────────────────────────────────────────────

describe("hasPermission — owner bypass", () => {
  it("owner always returns true for any permission", () => {
    expect(hasPermission("owner", undefined, "billing:manage")).toBe(true);
    expect(hasPermission("owner", undefined, "workflow:delete")).toBe(true);
    expect(hasPermission("owner", [], "settings:manage")).toBe(true);
  });

  it("owner returns true even with empty customPermissions", () => {
    expect(hasPermission("owner", [], "credential:delete")).toBe(true);
  });
});

// ─── hasPermission — role-based lookup ───────────────────────────────────────

describe("hasPermission — role-based lookup", () => {
  it("admin is allowed workflow:create", () => {
    expect(hasPermission("admin", undefined, "workflow:create")).toBe(true);
  });

  it("admin is denied billing:manage", () => {
    expect(hasPermission("admin", undefined, "billing:manage")).toBe(false);
  });

  it("editor is allowed workflow:execute", () => {
    expect(hasPermission("editor", undefined, "workflow:execute")).toBe(true);
  });

  it("editor is denied credential:create", () => {
    expect(hasPermission("editor", undefined, "credential:create")).toBe(false);
  });

  it("viewer is allowed workflow:read", () => {
    expect(hasPermission("viewer", undefined, "workflow:read")).toBe(true);
  });

  it("viewer is denied workflow:create", () => {
    expect(hasPermission("viewer", undefined, "workflow:create")).toBe(false);
  });

  it("unknown role is denied all permissions", () => {
    expect(hasPermission("guest", undefined, "workflow:read")).toBe(false);
    expect(hasPermission("", undefined, "workflow:read")).toBe(false);
  });
});

// ─── hasPermission — custom permissions override ─────────────────────────────

describe("hasPermission — customPermissions override", () => {
  it("custom permissions override role when non-empty", () => {
    // viewer with custom permission to create workflows
    expect(hasPermission("viewer", ["workflow:create", "workflow:read"], "workflow:create")).toBe(true);
  });

  it("custom permissions deny if permission not in the list", () => {
    // viewer with limited custom perms — no workflow:delete
    expect(hasPermission("viewer", ["workflow:read"], "workflow:delete")).toBe(false);
  });

  it("custom permissions replace role entirely when non-empty", () => {
    // admin normally has member:invite — but if customPermissions is set and doesn't include it, deny
    expect(hasPermission("admin", ["workflow:read"], "member:invite")).toBe(false);
  });

  it("empty customPermissions array falls back to role", () => {
    expect(hasPermission("admin", [], "member:invite" as Permission)).toBe(true);
  });

  it("undefined customPermissions falls back to role", () => {
    expect(hasPermission("editor", undefined, "workflow:update")).toBe(true);
  });
});
