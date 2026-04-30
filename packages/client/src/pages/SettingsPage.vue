<script setup lang="ts">
import { ref } from "vue";
import AppLayout from "../shared/components/AppLayout.vue";
import OrgSettingsPanel from "../features/settings/components/OrgSettingsPanel.vue";
import MembersPanel from "../features/settings/components/MembersPanel.vue";

type SettingsTab = "org" | "members";
const activeTab = ref<SettingsTab>("org");
</script>

<template>
  <AppLayout>
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Settings</h1>
      <p class="text-sm text-gray-400">Organisation and team configuration</p>
    </header>

    <main class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-3xl">
        <!-- Tabs -->
        <div class="mb-6 flex gap-1 border-b border-gray-200">
          <button
            v-for="tab in ([['org', 'Organisation'], ['members', 'Members']] as const)"
            :key="tab[0]"
            type="button"
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="activeTab === tab[0]
              ? 'border-b-2 border-violet-600 text-violet-700'
              : 'text-gray-500 hover:text-gray-700'"
            :data-testid="`settings-tab-${tab[0]}`"
            @click="activeTab = tab[0]"
          >
            {{ tab[1] }}
          </button>
        </div>

        <OrgSettingsPanel v-if="activeTab === 'org'" />
        <MembersPanel v-else-if="activeTab === 'members'" />
      </div>
    </main>
  </AppLayout>
</template>
