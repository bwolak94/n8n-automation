import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { CollaboratorUser } from "../shared/types/index.js";

export const useCollaborationStore = defineStore("collaboration", () => {
  const activeUsers = ref<CollaboratorUser[]>([]);
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

  // ── Actions ────────────────────────────────────────────────────────────────

  function addUser(user: CollaboratorUser): void {
    const exists = activeUsers.value.some((u) => u.userId === user.userId);
    if (!exists) {
      activeUsers.value.push(user);
    }
  }

  function removeUser(userId: string): void {
    activeUsers.value = activeUsers.value.filter((u) => u.userId !== userId);
  }

  function updateUserCursor(
    userId: string,
    cursor: { x: number; y: number }
  ): void {
    const user = activeUsers.value.find((u) => u.userId === userId);
    if (user) {
      user.cursor = cursor;
    }
  }

  function setConnected(connected: boolean): void {
    socketConnected.value = connected;
    if (!connected) {
      activeUsers.value = [];
    }
  }

  function setWorkflow(id: string | null): void {
    workflowId.value = id;
  }

  function reset(): void {
    activeUsers.value = [];
    socketConnected.value = false;
    workflowId.value = null;
  }

  return {
    activeUsers,
    socketConnected,
    workflowId,
    collaboratorCount,
    userById,
    addUser,
    removeUser,
    updateUserCursor,
    setConnected,
    setWorkflow,
    reset,
  };
});
