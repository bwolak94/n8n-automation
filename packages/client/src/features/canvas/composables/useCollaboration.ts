import { onMounted, onUnmounted, ref } from "vue";
import { io, type Socket } from "socket.io-client";
import { useCollaborationStore } from "../../../stores/collaborationStore.js";
import { useCanvasStore } from "../../../stores/canvasStore.js";
import { getStoredToken, getStoredTenantId } from "../../../shared/api/client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanvasOp {
  type: string;
  [key: string]: unknown;
}

interface OpAppliedPayload {
  op: CanvasOp;
  version: number;
  userId: string;
}

interface OpRejectedPayload {
  op: CanvasOp;
  reason: string;
  serverVersion: number;
  ops: Array<{ version: number; op: CanvasOp }>;
}

interface WorkflowStatePayload {
  version: number;
  ops: Array<{ version: number; op: CanvasOp }>;
}

// ─── Colour from userId hash (deterministic) ──────────────────────────────────

function userColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 55%)`;
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useCollaboration(workflowId: string) {
  const collaborationStore = useCollaborationStore();
  const canvasStore = useCanvasStore();

  const serverVersion = ref(0);
  let socket: Socket | null = null;

  function applyRemoteOp(op: CanvasOp): void {
    switch (op.type) {
      case "move_node": {
        const { nodeId, position } = op as unknown as { nodeId: string; position: { x: number; y: number } };
        canvasStore.updateNodePosition(nodeId, position);
        break;
      }
      case "update_config": {
        const { nodeId, config } = op as unknown as { nodeId: string; config: Record<string, unknown> };
        canvasStore.updateNodeConfig(nodeId, config);
        break;
      }
      case "delete_node": {
        const { nodeId } = op as unknown as { nodeId: string };
        canvasStore.removeNode(nodeId);
        break;
      }
      case "add_edge": {
        const { edgeId, source, target } = op as unknown as {
          edgeId: string;
          source: string;
          target: string;
        };
        canvasStore.addEdge({ id: edgeId, source, target });
        break;
      }
      case "delete_edge": {
        const { edgeId } = op as unknown as { edgeId: string };
        canvasStore.removeEdge(edgeId);
        break;
      }
      case "add_node": {
        const { node } = op as unknown as {
          node: { id: string; type: string; position: { x: number; y: number }; config: Record<string, unknown> };
        };
        canvasStore.addNode({
          id: node.id,
          type: node.type,
          label: node.type,
          category: "actions",
          position: node.position,
          config: node.config,
        });
        break;
      }
    }
  }

  function submitOp(op: CanvasOp): void {
    if (!socket?.connected) return;

    // Optimistic apply
    applyRemoteOp(op);

    socket.emit("op:submit", { op, baseVersion: serverVersion.value });
  }

  function connect(): void {
    const token = getStoredToken();
    const tenantId = getStoredTenantId() ?? undefined;

    socket = io(import.meta.env?.VITE_WS_URL ?? "/", {
      auth: { token, tenantId },
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      collaborationStore.setConnected(true);
      collaborationStore.setWorkflow(workflowId);
      collaborationStore.setRoomId(`workflow:${workflowId}`);
      socket!.emit("workflow:join", workflowId);
    });

    socket.on("disconnect", () => {
      collaborationStore.setConnected(false);
    });

    socket.on("workflow:state", (state: WorkflowStatePayload) => {
      serverVersion.value = state.version;
    });

    socket.on("op:applied", (payload: OpAppliedPayload) => {
      serverVersion.value = payload.version;
      // Remote ops: apply to canvas. Our own ops were applied optimistically.
      if (payload.userId !== socket?.id) {
        applyRemoteOp(payload.op);
      }
    });

    socket.on("op:rejected", (payload: OpRejectedPayload) => {
      // Rollback: reload server version from state
      serverVersion.value = payload.serverVersion;
      // Re-apply all server ops to rebuild canonical state
      // (simple: reload workflow from server via store)
      console.warn("[Collaboration] Op rejected:", payload.reason);
    });

    socket.on("peer:joined", (peer: { userId: string; email: string }) => {
      collaborationStore.setPeer({
        userId: peer.userId,
        email: peer.email,
        color: userColor(peer.userId),
      });
    });

    socket.on("peer:left", (peer: { userId: string }) => {
      collaborationStore.removePeer(peer.userId);
    });

    socket.on("cursor:updated", (event: { userId: string; cursor: { x: number; y: number } }) => {
      collaborationStore.updateUserCursor(event.userId, event.cursor);
    });
  }

  function sendCursor(cursor: { x: number; y: number }): void {
    if (!socket?.connected) return;
    collaborationStore.setLocalCursor(cursor);
    socket.emit("cursor:move", cursor);
  }

  function disconnect(): void {
    socket?.disconnect();
    socket = null;
    collaborationStore.reset();
  }

  onMounted(connect);
  onUnmounted(disconnect);

  return {
    serverVersion,
    submitOp,
    sendCursor,
    disconnect,
  };
}
