import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ─── Setup ────────────────────────────────────────────────────────────────────

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

beforeEach(() => {
  setActivePinia(createPinia());
});

// ─────────────────────────────────────────────────────────────────────────────
// uiStore
// ─────────────────────────────────────────────────────────────────────────────

describe("uiStore", () => {
  const setup = async () => {
    const { useUiStore } = await import("../uiStore.js");
    return useUiStore();
  };

  it("toggleSidebar flips sidebarOpen", async () => {
    const store = await setup();
    expect(store.sidebarOpen).toBe(true);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarOpen).toBe(true);
  });

  it("setSidebarOpen sets to the given value", async () => {
    const store = await setup();
    store.setSidebarOpen(false);
    expect(store.sidebarOpen).toBe(false);
  });

  it("openPanel sets activePanel and closePanel clears it", async () => {
    const store = await setup();
    store.openPanel("config");
    expect(store.activePanel).toBe("config");
    store.closePanel();
    expect(store.activePanel).toBeNull();
  });

  it("notify adds a notification and returns its id", async () => {
    vi.useFakeTimers();
    const store = await setup();
    const id = store.notify("Hello", "success", 0);
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]?.message).toBe("Hello");
    expect(id).toBeTruthy();
    vi.useRealTimers();
  });

  it("notify with duration auto-dismisses after timeout", async () => {
    vi.useFakeTimers();
    const store = await setup();
    store.notify("Auto-dismiss", "info", 1000);
    expect(store.notifications).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(store.notifications).toHaveLength(0);
    vi.useRealTimers();
  });

  it("dismissNotification removes the matching notification", async () => {
    vi.useFakeTimers();
    const store = await setup();
    const id = store.notify("Bye", "warning", 0);
    store.dismissNotification(id);
    expect(store.notifications).toHaveLength(0);
    vi.useRealTimers();
  });

  it("clearNotifications removes all notifications", async () => {
    vi.useFakeTimers();
    const store = await setup();
    store.notify("A", "info", 0);
    store.notify("B", "error", 0);
    store.clearNotifications();
    expect(store.notifications).toHaveLength(0);
    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// executionStore
// ─────────────────────────────────────────────────────────────────────────────

describe("executionStore", () => {
  const setup = async () => {
    const { useExecutionStore } = await import("../executionStore.js");
    return useExecutionStore();
  };

  const exec = {
    id: "exec-1",
    workflowId: "wf-1",
    tenantId: "t1",
    status: "running",
    steps: [],
    startedAt: "2024-01-01T00:00:00Z",
  } as const;

  it("setExecution adds an execution to the map", async () => {
    const store = await setup();
    store.setExecution(exec);
    expect(store.executions.get("exec-1")).toEqual(exec);
  });

  it("updateExecutionStatus updates the status", async () => {
    const store = await setup();
    store.setExecution(exec);
    store.updateExecutionStatus("exec-1", "completed");
    expect(store.executions.get("exec-1")?.status).toBe("completed");
  });

  it("updateExecutionStatus is a no-op for unknown id", async () => {
    const store = await setup();
    store.updateExecutionStatus("non-existent", "completed");
    expect(store.executions.size).toBe(0);
  });

  it("setCurrentExecution sets currentExecutionId", async () => {
    const store = await setup();
    store.setCurrentExecution("exec-1");
    expect(store.currentExecutionId).toBe("exec-1");
  });

  it("currentExecution computed returns the current execution", async () => {
    const store = await setup();
    store.setExecution(exec);
    store.setCurrentExecution("exec-1");
    expect(store.currentExecution?.id).toBe("exec-1");
  });

  it("currentExecution is null when currentExecutionId is null", async () => {
    const store = await setup();
    expect(store.currentExecution).toBeNull();
  });

  it("removeExecution deletes the entry and clears currentExecutionId if matching", async () => {
    const store = await setup();
    store.setExecution(exec);
    store.setCurrentExecution("exec-1");
    store.removeExecution("exec-1");
    expect(store.executions.has("exec-1")).toBe(false);
    expect(store.currentExecutionId).toBeNull();
  });

  it("clearAll empties the map and resets currentExecutionId", async () => {
    const store = await setup();
    store.setExecution(exec);
    store.setCurrentExecution("exec-1");
    store.clearAll();
    expect(store.executions.size).toBe(0);
    expect(store.currentExecutionId).toBeNull();
  });

  it("executionList is sorted by startedAt descending", async () => {
    const store = await setup();
    store.setExecution({ ...exec, id: "a", startedAt: "2024-01-01T00:00:00Z" });
    store.setExecution({ ...exec, id: "b", startedAt: "2024-01-02T00:00:00Z" });
    const [first] = store.executionList;
    expect(first?.id).toBe("b");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// nodeRegistryStore
// ─────────────────────────────────────────────────────────────────────────────

describe("nodeRegistryStore", () => {
  const setup = async () => {
    const { useNodeRegistryStore } = await import("../nodeRegistryStore.js");
    return useNodeRegistryStore();
  };

  const defs = [
    { type: "http_request", label: "HTTP Request", description: "", icon: "", category: "actions", configSchema: {}, inputSchema: {}, outputSchema: {} },
    { type: "delay", label: "Delay", description: "", icon: "", category: "logic", configSchema: {}, inputSchema: {}, outputSchema: {} },
  ];

  it("setDefinitions populates definitions and sets isLoaded", async () => {
    const store = await setup();
    store.setDefinitions(defs);
    expect(store.definitions).toHaveLength(2);
    expect(store.isLoaded).toBe(true);
  });

  it("getDefinition returns the correct definition by type", async () => {
    const store = await setup();
    store.setDefinitions(defs);
    expect(store.getDefinition("http_request")?.label).toBe("HTTP Request");
  });

  it("getDefinition returns undefined for unknown type", async () => {
    const store = await setup();
    store.setDefinitions(defs);
    expect(store.getDefinition("unknown")).toBeUndefined();
  });

  it("byCategory groups definitions by category", async () => {
    const store = await setup();
    store.setDefinitions(defs);
    expect(store.byCategory["actions"]).toHaveLength(1);
    expect(store.byCategory["logic"]).toHaveLength(1);
  });

  it("reset clears definitions and isLoaded", async () => {
    const store = await setup();
    store.setDefinitions(defs);
    store.reset();
    expect(store.definitions).toHaveLength(0);
    expect(store.isLoaded).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tenantStore
// ─────────────────────────────────────────────────────────────────────────────

describe("tenantStore", () => {
  const setup = async () => {
    const { useTenantStore } = await import("../tenantStore.js");
    return useTenantStore();
  };

  it("setTenant sets tenantId, role, and plan", async () => {
    const store = await setup();
    store.setTenant("t1", "owner", "pro");
    expect(store.tenantId).toBe("t1");
    expect(store.role).toBe("owner");
    expect(store.plan).toBe("pro");
  });

  it("isOwner is true only for owner role", async () => {
    const store = await setup();
    store.setTenant("t1", "owner");
    expect(store.isOwner).toBe(true);
    store.setTenant("t1", "admin");
    expect(store.isOwner).toBe(false);
  });

  it("isAdmin is true for owner and admin", async () => {
    const store = await setup();
    store.setTenant("t1", "viewer");
    expect(store.isAdmin).toBe(false);
    store.setTenant("t1", "admin");
    expect(store.isAdmin).toBe(true);
    store.setTenant("t1", "owner");
    expect(store.isAdmin).toBe(true);
  });

  it("canEdit is true for owner, admin, and editor", async () => {
    const store = await setup();
    store.setTenant("t1", "viewer");
    expect(store.canEdit).toBe(false);
    store.setTenant("t1", "editor");
    expect(store.canEdit).toBe(true);
  });

  it("clear resets all fields to null", async () => {
    const store = await setup();
    store.setTenant("t1", "owner", "pro");
    store.clear();
    expect(store.tenantId).toBeNull();
    expect(store.role).toBeNull();
    expect(store.plan).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// collaborationStore
// ─────────────────────────────────────────────────────────────────────────────

describe("collaborationStore", () => {
  const setup = async () => {
    const { useCollaborationStore } = await import("../collaborationStore.js");
    return useCollaborationStore();
  };

  const user1 = { userId: "u1", email: "a@b.com", color: "#ff0000" };
  const user2 = { userId: "u2", email: "c@d.com", color: "#00ff00" };

  it("addUser adds a collaborator", async () => {
    const store = await setup();
    store.addUser(user1);
    expect(store.activeUsers).toHaveLength(1);
  });

  it("addUser ignores duplicate users", async () => {
    const store = await setup();
    store.addUser(user1);
    store.addUser(user1);
    expect(store.activeUsers).toHaveLength(1);
  });

  it("removeUser removes a collaborator by userId", async () => {
    const store = await setup();
    store.addUser(user1);
    store.addUser(user2);
    store.removeUser("u1");
    expect(store.activeUsers).toHaveLength(1);
    expect(store.activeUsers[0]?.userId).toBe("u2");
  });

  it("updateUserCursor updates the cursor position", async () => {
    const store = await setup();
    store.addUser(user1);
    store.updateUserCursor("u1", { x: 10, y: 20 });
    expect(store.activeUsers[0]?.cursor).toEqual({ x: 10, y: 20 });
  });

  it("updateUserCursor is a no-op for unknown user", async () => {
    const store = await setup();
    store.updateUserCursor("unknown", { x: 0, y: 0 });
    expect(store.activeUsers).toHaveLength(0);
  });

  it("setConnected clears users when disconnecting", async () => {
    const store = await setup();
    store.addUser(user1);
    store.setConnected(false);
    expect(store.socketConnected).toBe(false);
    expect(store.activeUsers).toHaveLength(0);
  });

  it("setConnected sets connected state to true", async () => {
    const store = await setup();
    store.setConnected(true);
    expect(store.socketConnected).toBe(true);
  });

  it("collaboratorCount computed returns user count", async () => {
    const store = await setup();
    store.addUser(user1);
    store.addUser(user2);
    expect(store.collaboratorCount).toBe(2);
  });

  it("userById computed maps userId to user", async () => {
    const store = await setup();
    store.addUser(user1);
    expect(store.userById["u1"]).toEqual(user1);
  });

  it("reset clears all state", async () => {
    const store = await setup();
    store.addUser(user1);
    store.setConnected(true);
    store.setWorkflow("wf-1");
    store.reset();
    expect(store.activeUsers).toHaveLength(0);
    expect(store.socketConnected).toBe(false);
    expect(store.workflowId).toBeNull();
  });
});
