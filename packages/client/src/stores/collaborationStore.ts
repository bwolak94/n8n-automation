import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CollaboratorUser } from "../shared/types/index.js";

// ─── Peer state ───────────────────────────────────────────────────────────────

export interface PeerState {
  userId: string;
  email: string;
  color: string;
  cursor?: { x: number; y: number };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCollaborationStore = defineStore("collaboration", () => {
  // Legacy list (kept for backward compat)
  const activeUsers = ref<CollaboratorUser[]>([]);

  // New structured state
  const peers = ref<Map<string, PeerState>>(new Map());
  const localCursor = ref<{ x: number; y: number } | null>(null);
  const roomId = ref<string | null>(null);

  const socketConnected = ref(false);
  const workflowId = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────

  const collaboratorCount = computed(() => activeUsers.value.length);

  const userById = computed(() => {
    const map: Record<string, CollaboratorUser> = {};
    for (const u of activeUsers.value) {
      map[u.userId] = u;
    }
    return map;
  });

  const peerList = computed<PeerState[]>(() =>
    Array.from(peers.value.values())
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  function addUser(user: CollaboratorUser): void {
    const exists = activeUsers.value.some((u) => u.userId === user.userId);
    if (!exists) {
      activeUsers.value.push(user);
    }
    // Sync to peers map
    if (!peers.value.has(user.userId)) {
      peers.value.set(user.userId, { ...user });
    }
  }

  function removeUser(userId: string): void {
    activeUsers.value = activeUsers.value.filter((u) => u.userId !== userId);
    peers.value.delete(userId);
  }

  function updateUserCursor(
    userId: string,
    cursor: { x: number; y: number }
  ): void {
    const user = activeUsers.value.find((u) => u.userId === userId);
    if (user) {
      user.cursor = cursor;
    }
    const peer = peers.value.get(userId);
    if (peer) {
      peers.value.set(userId, { ...peer, cursor });
    }
  }

  function setPeer(peer: PeerState): void {
    peers.value.set(peer.userId, peer);
    // Keep activeUsers in sync
    const existing = activeUsers.value.find((u) => u.userId === peer.userId);
    if (existing) {
      existing.cursor = peer.cursor;
    } else {
      activeUsers.value.push({ userId: peer.userId, email: peer.email, color: peer.color, cursor: peer.cursor });
    }
  }

  function removePeer(userId: string): void {
    peers.value.delete(userId);
    activeUsers.value = activeUsers.value.filter((u) => u.userId !== userId);
  }

  function setLocalCursor(cursor: { x: number; y: number } | null): void {
    localCursor.value = cursor;
  }

  function setRoomId(id: string | null): void {
    roomId.value = id;
  }

  function setConnected(connected: boolean): void {
    socketConnected.value = connected;
    if (!connected) {
      activeUsers.value = [];
      peers.value.clear();
    }
  }

  function setWorkflow(id: string | null): void {
    workflowId.value = id;
  }

  function reset(): void {
    activeUsers.value = [];
    peers.value.clear();
    localCursor.value = null;
    roomId.value = null;
    socketConnected.value = false;
    workflowId.value = null;
  }

  return {
    activeUsers,
    peers,
    localCursor,
    roomId,
    socketConnected,
    workflowId,
    collaboratorCount,
    userById,
    peerList,
    addUser,
    removeUser,
    updateUserCursor,
    setPeer,
    removePeer,
    setLocalCursor,
    setRoomId,
    setConnected,
    setWorkflow,
    reset,
  };
});
