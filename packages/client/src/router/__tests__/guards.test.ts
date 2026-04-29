import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { authGuard } from "../guards.js";
import { useAuthStore } from "../../stores/authStore.js";
import type { RouteLocationNormalized } from "vue-router";

// ─── Mock API deps ────────────────────────────────────────────────────────────

vi.mock("../../shared/api/auth.js", () => ({
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
}));

vi.mock("../../shared/api/client.js", () => ({
  TOKEN_KEY: "automation-hub-token",
  TENANT_ID_KEY: "automation-hub-tenant-id",
  setUnauthorizedHandler: vi.fn(),
  getStoredToken: vi.fn(() => null),
  getStoredTenantId: vi.fn(() => null),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRoute(
  name: string,
  meta: Record<string, unknown> = {}
): RouteLocationNormalized {
  return {
    name,
    path: `/${name}`,
    fullPath: `/${name}`,
    meta,
    params: {},
    query: {},
    hash: "",
    matched: [],
    redirectedFrom: undefined,
  } as unknown as RouteLocationNormalized;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authGuard", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ── Unauthenticated user ────────────────────────────────────────────────────

  it("redirects to login when unauthenticated and route requiresAuth", () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);

    const to = makeRoute("home", { requiresAuth: true });
    const result = authGuard(to, makeRoute("login"), () => {});

    expect(result).toEqual({
      name: "login",
      query: { redirect: "/home" },
    });
  });

  it("allows navigation to public routes when unauthenticated", () => {
    const to = makeRoute("login", { requiresAuth: false });
    const result = authGuard(to, makeRoute("home"), () => {});

    expect(result).toBe(true);
  });

  it("allows navigation when route has no requiresAuth meta", () => {
    const to = makeRoute("about", {});
    const result = authGuard(to, makeRoute("home"), () => {});

    expect(result).toBe(true);
  });

  // ── Authenticated user ─────────────────────────────────────────────────────

  it("redirects authenticated user away from /login to home", async () => {
    const { loginApi } = await import("../../shared/api/auth.js");
    vi.mocked(loginApi).mockResolvedValueOnce({
      token:
        "eyJhbGciOiJIUzI1NiJ9." +
        btoa(JSON.stringify({ userId: "u1", email: "a@b.com" })) +
        ".sig",
      tenantId: "t1",
      role: "owner",
    });

    const store = useAuthStore();
    await store.login({ email: "a@b.com", password: "secret" });
    expect(store.isAuthenticated).toBe(true);

    const to = makeRoute("login", { requiresAuth: false });
    const result = authGuard(to, makeRoute("home"), () => {});

    expect(result).toEqual({ name: "home" });
  });

  it("allows authenticated user to access protected routes", async () => {
    const { loginApi } = await import("../../shared/api/auth.js");
    vi.mocked(loginApi).mockResolvedValueOnce({
      token:
        "eyJhbGciOiJIUzI1NiJ9." +
        btoa(JSON.stringify({ userId: "u1", email: "a@b.com" })) +
        ".sig",
      tenantId: "t1",
      role: "owner",
    });

    const store = useAuthStore();
    await store.login({ email: "a@b.com", password: "secret" });

    const to = makeRoute("home", { requiresAuth: true });
    const result = authGuard(to, makeRoute("login"), () => {});

    expect(result).toBe(true);
  });
});
