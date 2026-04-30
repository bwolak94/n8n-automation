<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "../../stores/authStore.js";
import { useTenantStore } from "../../stores/tenantStore.js";

const route = useRoute();
const authStore = useAuthStore();
const tenantStore = useTenantStore();

const isAdmin = computed(() => tenantStore.isAdmin);

const navItems = [
  { label: "Dashboard", icon: "📊", path: "/" },
  { label: "Workflows", icon: "⚡", path: "/workflows" },
  { label: "Marketplace", icon: "🛒", path: "/marketplace" },
  { label: "Dead Letter Queue", icon: "💀", path: "/dlq" },
  { label: "Settings", icon: "⚙️", path: "/settings" },
] as const;

function isActive(path: string): boolean {
  if (path === "/") return route.path === "/";
  return route.path.startsWith(path);
}
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <!-- Logo -->
      <div class="border-b border-gray-100 px-5 py-5">
        <p class="text-sm font-bold tracking-tight text-gray-900">Automation Hub</p>
        <p class="text-xs text-gray-400">Workflow platform</p>
      </div>

      <!-- Nav -->
      <nav class="flex flex-1 flex-col gap-1 p-3" aria-label="Main navigation">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="isActive(item.path)
            ? 'bg-violet-50 text-violet-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
          :data-testid="`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`"
        >
          <span aria-hidden="true">{{ item.icon }}</span>
          {{ item.label }}
        </router-link>
      </nav>

      <!-- User + logout -->
      <div class="border-t border-gray-100 p-3">
        <div class="mb-2 px-1">
          <p class="truncate text-xs font-medium text-gray-700">{{ authStore.user?.email }}</p>
          <p class="text-xs capitalize text-gray-400">{{ authStore.user?.role }}</p>
        </div>
        <button
          class="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
          @click="authStore.logout()"
        >
          Sign out
        </button>
      </div>
    </aside>

    <!-- Content slot -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>
