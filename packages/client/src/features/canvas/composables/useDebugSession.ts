import { ref, reactive, readonly } from "vue";
import { io } from "socket.io-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DebugNodeStatus = "pending" | "running" | "completed" | "error" | "skipped" | "mocked";

export interface DebugNodeState {
  status:      DebugNodeStatus;
  input?:      unknown;
  output?:     unknown;
  error?:      string;
  durationMs?: number;
}

export interface DebugSessionOptions {
  workflowId:  string;
  triggerData: Record<string, unknown>;
  breakpoints: string[];
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useDebugSession(token: string, tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socket        = ref<any>(null);
  const sessionId     = ref<string | null>(null);
  const status        = ref<"idle" | "running" | "paused" | "completed" | "error">("idle");
  const errorMessage  = ref<string | null>(null);
  const nodeStates    = reactive<Record<string, DebugNodeState>>({});
  const currentNodeId = ref<string | null>(null);
  const breakpoints   = reactive<Set<string>>(new Set());

  // ── Internal helpers ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ensureSocket(): any {
    if (socket.value) return socket.value;

    const s = io("/debug", {
      auth:       { token, tenantId },
      transports: ["websocket"],
    });

    s.on("connect_error", (err: Error) => {
      errorMessage.value = `Debug connection failed: ${err.message}`;
      status.value       = "error";
    });

    s.on("debug:sessionCreated", (data: { sessionId: string }) => {
      sessionId.value = data.sessionId;
    });

    s.on("debug:nodeStart", (data: { sessionId: string; nodeId: string }) => {
      if (data.sessionId !== sessionId.value) return;
      currentNodeId.value = data.nodeId;
      nodeStates[data.nodeId] = { ...nodeStates[data.nodeId], status: "running" };
      status.value = "running";
    });

    s.on("debug:nodeEnd", (data: {
      sessionId: string;
      nodeId:    string;
      output:    unknown;
      durationMs: number;
      mocked?:   boolean;
    }) => {
      if (data.sessionId !== sessionId.value) return;
      nodeStates[data.nodeId] = {
        ...(nodeStates[data.nodeId] ?? {}),
        status:     data.mocked ? "mocked" : "completed",
        output:     data.output,
        durationMs: data.durationMs,
      };
    });

    s.on("debug:nodeError", (data: { sessionId: string; nodeId: string; error: string }) => {
      if (data.sessionId !== sessionId.value) return;
      nodeStates[data.nodeId] = {
        ...(nodeStates[data.nodeId] ?? {}),
        status: "error",
        error:  data.error,
      };
    });

    s.on("debug:paused", (data: { sessionId: string; nodeId: string }) => {
      if (data.sessionId !== sessionId.value) return;
      status.value        = "paused";
      currentNodeId.value = data.nodeId;
    });

    s.on("debug:complete", (data: { sessionId: string }) => {
      if (data.sessionId !== sessionId.value) return;
      status.value        = "completed";
      currentNodeId.value = null;
    });

    s.on("debug:mockSet", () => { /* acknowledged */ });

    s.on("debug:cancelled", () => {
      reset();
    });

    s.on("debug:error", (data: { message: string }) => {
      errorMessage.value = data.message;
      status.value       = "error";
    });

    socket.value = s;
    return s;
  }

  function reset(): void {
    sessionId.value     = null;
    status.value        = "idle";
    errorMessage.value  = null;
    currentNodeId.value = null;
    Object.keys(nodeStates).forEach((k) => delete nodeStates[k]);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function start(opts: DebugSessionOptions): void {
    reset();
    // Sync breakpoints with local set
    breakpoints.clear();
    opts.breakpoints.forEach((id) => breakpoints.add(id));

    const s = ensureSocket();
    s.emit("debug:start", {
      workflowId:  opts.workflowId,
      triggerData: opts.triggerData,
      breakpoints: [...breakpoints],
    });
    status.value = "running";
  }

  function stepOver(): void {
    if (!sessionId.value || !socket.value) return;
    socket.value.emit("debug:step", { sessionId: sessionId.value });
  }

  function setMockOutput(nodeId: string, mockData: unknown): void {
    if (!sessionId.value || !socket.value) return;
    socket.value.emit("debug:mock", { sessionId: sessionId.value, nodeId, mockData });
  }

  function cancel(): void {
    if (!sessionId.value || !socket.value) return;
    socket.value.emit("debug:cancel", { sessionId: sessionId.value });
  }

  function toggleBreakpoint(nodeId: string): void {
    if (breakpoints.has(nodeId)) {
      breakpoints.delete(nodeId);
    } else {
      breakpoints.add(nodeId);
    }
  }

  function disconnect(): void {
    socket.value?.disconnect();
    socket.value = null;
    reset();
  }

  return {
    // State (readonly refs to prevent accidental mutation outside composable)
    sessionId:     readonly(sessionId),
    status:        readonly(status),
    errorMessage:  readonly(errorMessage),
    currentNodeId: readonly(currentNodeId),
    nodeStates,
    breakpoints,
    // Actions
    start,
    stepOver,
    setMockOutput,
    cancel,
    toggleBreakpoint,
    disconnect,
  };
}
