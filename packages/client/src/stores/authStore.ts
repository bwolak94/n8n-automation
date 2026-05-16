import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { loginApi } from "../shared/api/auth.js";
import {
  TOKEN_KEY,
  TENANT_ID_KEY,
  setUnauthorizedHandler,
} from "../shared/api/client.js";
import type { AuthUser, LoginCredentials } from "../shared/types/index.js";

// ─── JWT parser (no signature verification needed on client) ──────────────────

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return {};
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<AuthUser | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  // Rehydrate user from stored token on startup
  if (token.value) {
    const payload = parseJwtPayload(token.value);
    user.value = {
      userId: (payload["userId"] as string) ?? "",
      email: (payload["email"] as string) ?? "",
      tenantId: localStorage.getItem(TENANT_ID_KEY) ?? "",
      role: (payload["role"] as string) ?? "viewer",
    };
  }

  function _applyToken(jwt: string, tenantId: string, role: string): void {
    token.value = jwt;
    localStorage.setItem(TOKEN_KEY, jwt);
    localStorage.setItem(TENANT_ID_KEY, tenantId);
    const payload = parseJwtPayload(jwt);
    user.value = {
      userId: (payload["userId"] as string) ?? "",
      email: (payload["email"] as string) ?? "",
      tenantId,
      role,
    };
  }

  async function login(credentials: LoginCredentials): Promise<void> {
    const response = await loginApi(credentials);
    _applyToken(response.token, response.tenantId, response.role);
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_ID_KEY);
  }

  // Register the logout handler so the API client can call it on 401
  setUnauthorizedHandler(logout);

  return { token, user, isAuthenticated, login, logout };
});
