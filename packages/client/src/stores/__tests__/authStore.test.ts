import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "../authStore.js";

// ─── Mock API ─────────────────────────────────────────────────────────────────

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

import { loginApi } from "../../shared/api/auth.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// A minimal JWT with payload { userId: "u1", email: "a@b.com" }
const FAKE_JWT =
  "eyJhbGciOiJIUzI1NiJ9." +
  btoa(JSON.stringify({ userId: "u1", email: "a@b.com" })) +
  ".sig";

const MOCK_AUTH_RESPONSE = {
  token: FAKE_JWT,
  tenantId: "tenant-1",
  role: "owner",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it("starts unauthenticated when no token in localStorage", () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
  });

  // ── login ──────────────────────────────────────────────────────────────────

  it("login sets token, user, and persists to localStorage on success", async () => {
    vi.mocked(loginApi).mockResolvedValueOnce(MOCK_AUTH_RESPONSE);

    const store = useAuthStore();
    await store.login({ email: "a@b.com", password: "secret" });

    expect(store.isAuthenticated).toBe(true);
    expect(store.token).toBe(FAKE_JWT);
    expect(store.user?.email).toBe("a@b.com");
    expect(store.user?.tenantId).toBe("tenant-1");
    expect(store.user?.role).toBe("owner");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "automation-hub-token",
      FAKE_JWT
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "automation-hub-tenant-id",
      "tenant-1"
    );
  });

  it("login propagates errors from the API", async () => {
    vi.mocked(loginApi).mockRejectedValueOnce(new Error("Invalid credentials"));

    const store = useAuthStore();
    await expect(
      store.login({ email: "bad@b.com", password: "wrong" })
    ).rejects.toThrow("Invalid credentials");

    expect(store.isAuthenticated).toBe(false);
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  it("logout clears token, user, and localStorage", async () => {
    vi.mocked(loginApi).mockResolvedValueOnce(MOCK_AUTH_RESPONSE);
    const store = useAuthStore();
    await store.login({ email: "a@b.com", password: "secret" });

    store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith("automation-hub-token");
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      "automation-hub-tenant-id"
    );
  });

  // ── Token rehydration ──────────────────────────────────────────────────────

  it("rehydrates user from localStorage token on startup", () => {
    // Pre-populate via setItem (updates the mock's internal store map)
    localStorage.setItem("automation-hub-token", FAKE_JWT);
    localStorage.setItem("automation-hub-tenant-id", "tenant-rehydrated");

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.user?.email).toBe("a@b.com");
    expect(store.user?.tenantId).toBe("tenant-rehydrated");
  });

  // ── isAuthenticated getter ─────────────────────────────────────────────────

  it("isAuthenticated is reactive — becomes true after login, false after logout", async () => {
    vi.mocked(loginApi).mockResolvedValueOnce(MOCK_AUTH_RESPONSE);
    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(false);
    await store.login({ email: "a@b.com", password: "secret" });
    expect(store.isAuthenticated).toBe(true);
    store.logout();
    expect(store.isAuthenticated).toBe(false);
  });
});
