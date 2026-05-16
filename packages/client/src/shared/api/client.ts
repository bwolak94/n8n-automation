import ky, { type KyInstance, HTTPError } from "ky";

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const TOKEN_KEY = "automation-hub-token";
export const TENANT_ID_KEY = "automation-hub-tenant-id";

// ─── Unauthorized callback ────────────────────────────────────────────────────

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler): void {
  unauthorizedHandler = fn;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(TENANT_ID_KEY);
}

// ─── Factory (allows injecting prefixUrl for testing) ─────────────────────────

export function createApiClient(prefixUrl?: string): KyInstance {
  return ky.create({
    prefixUrl: prefixUrl ?? (import.meta.env?.VITE_API_URL ?? "/api"),
    timeout: 30_000,
    hooks: {
      beforeRequest: [
        (req) => {
          const token = getStoredToken();
          if (token) {
            req.headers.set("Authorization", `Bearer ${token}`);
          }
          const tenantId = getStoredTenantId();
          if (tenantId) {
            req.headers.set("X-Tenant-Id", tenantId);
          }
        },
      ],
      beforeError: [
        (error: HTTPError) => {
          if (error.response?.status === 401) {
            if (unauthorizedHandler) {
              unauthorizedHandler();
            } else {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(TENANT_ID_KEY);
              window.location.href = "/login";
            }
          }
          return error;
        },
      ],
    },
  });
}

export const apiClient: KyInstance = createApiClient();
