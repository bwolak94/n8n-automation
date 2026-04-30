<script setup lang="ts">
import AppLayout from "../shared/components/AppLayout.vue";
import DlqPanel from "../features/execution/components/DlqPanel.vue";
</script>

<template>
  <AppLayout>
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Dead Letter Queue</h1>
      <p class="text-sm text-gray-400">Failed jobs awaiting retry or discard</p>
    </header>
    <main class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-4xl">
        <DlqPanel />
      </div>
    </main>
  </AppLayout>
</template>
