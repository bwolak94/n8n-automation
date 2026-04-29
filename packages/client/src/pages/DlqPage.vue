<script setup lang="ts">
import DlqPanel from "../features/execution/components/DlqPanel.vue";
</script>

<template>
  <div class="flex min-h-screen bg-gray-50">
    <!-- Sidebar (reuse same structure) -->
    <aside class="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-5">
        <p class="text-sm font-bold tracking-tight text-gray-900">Automation Hub</p>
        <p class="text-xs text-gray-400">Workflow platform</p>
      </div>
      <nav class="flex flex-1 flex-col gap-1 p-3" aria-label="Main navigation">
        <router-link
          to="/"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden="true">⚡</span> Workflows
        </router-link>
        <router-link
          to="/dlq"
          class="flex items-center gap-2.5 rounded-lg bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700"
        >
          <span aria-hidden="true">💀</span> Dead Letter Queue
        </router-link>
      </nav>
    </aside>

    <!-- Main content -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="border-b border-gray-200 bg-white px-6 py-4">
        <h1 class="text-lg font-semibold text-gray-900">Dead Letter Queue</h1>
        <p class="text-sm text-gray-400">Failed jobs awaiting retry or discard</p>
      </header>
      <main class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-4xl">
          <DlqPanel />
        </div>
      </main>
    </div>
  </div>
</template>
