import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createApiClient,
  TOKEN_KEY,
  TENANT_ID_KEY,
  setUnauthorizedHandler,
} from "../client.js";

// ─── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

function capturedRequest(): Request {
  return (vi.mocked(fetch).mock.calls[0] as [Request])[0];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("apiClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Authorization header ───────────────────────────────────────────────────

  it("attaches Authorization header when token is stored", async () => {
    localStorage.setItem(TOKEN_KEY, "my-jwt-token");
    mockFetch(200, { ok: true });

    const client = createApiClient("http://localhost/api/");
    await client.get("test").json();

    const req = capturedRequest();
    expect(req.headers.get("Authorization")).toBe("Bearer my-jwt-token");
  });

  it("does not attach Authorization header when no token", async () => {
    mockFetch(200, {});

    const client = createApiClient("http://localhost/api/");
    await client.get("test").json();

    const req = capturedRequest();
    expect(req.headers.get("Authorization")).toBeNull();
  });

  it("attaches X-Tenant-Id header when tenantId is stored", async () => {
    localStorage.setItem(TENANT_ID_KEY, "tenant-abc");
    mockFetch(200, {});

    const client = createApiClient("http://localhost/api/");
    await client.get("test").json();

    const req = capturedRequest();
    expect(req.headers.get("X-Tenant-Id")).toBe("tenant-abc");
  });

  // ── 401 handling ───────────────────────────────────────────────────────────

  it("calls the registered unauthorizedHandler on 401", async () => {
    mockFetch(401, { error: "Unauthorized" });

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const client = createApiClient("http://localhost/api/");
    try {
      await client.get("protected").json();
    } catch {
      // ky throws on non-2xx
    }

    expect(handler).toHaveBeenCalledOnce();

    // cleanup
    setUnauthorizedHandler(() => {});
  });

  it("does NOT call handler on non-401 errors", async () => {
    mockFetch(500, { error: "Server error" });

    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    const client = createApiClient("http://localhost/api/");
    try {
      await client.get("broken").json();
    } catch {
      // expected
    }

    expect(handler).not.toHaveBeenCalled();

    setUnauthorizedHandler(() => {});
  });

  // ── Network error ──────────────────────────────────────────────────────────

  it("propagates network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const client = createApiClient("http://localhost/api/");
    await expect(client.get("test").json()).rejects.toThrow();
  });
});
