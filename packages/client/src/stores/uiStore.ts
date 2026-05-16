import { defineStore } from "pinia";
import { ref } from "vue";
import type { Notification, NotificationType } from "../shared/types/index.js";

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useUiStore = defineStore("ui", () => {
  const sidebarOpen = ref(true);
  const activePanel = ref<string | null>(null);
  const notifications = ref<Notification[]>([]);

  // ── Sidebar ────────────────────────────────────────────────────────────────

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setSidebarOpen(open: boolean): void {
    sidebarOpen.value = open;
  }

  // ── Panels ─────────────────────────────────────────────────────────────────

  function openPanel(name: string): void {
    activePanel.value = name;
  }

  function closePanel(): void {
    activePanel.value = null;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  function notify(message: string, type: NotificationType = "info", duration = 4000): string {
    const id = generateId();
    const notification: Notification = { id, type, message, duration };
    notifications.value.push(notification);

    if (duration > 0) {
      setTimeout(() => dismissNotification(id), duration);
    }

    return id;
  }

  function dismissNotification(id: string): void {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  function clearNotifications(): void {
    notifications.value = [];
  }

  return {
    sidebarOpen,
    activePanel,
    notifications,
    toggleSidebar,
    setSidebarOpen,
    openPanel,
    closePanel,
    notify,
    dismissNotification,
    clearNotifications,
  };
});
