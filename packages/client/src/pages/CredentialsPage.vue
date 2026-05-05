<script setup lang="ts">
import AppLayout from "../shared/components/AppLayout.vue";
import CredentialList from "../features/settings/components/CredentialList.vue";
</script>

<template>
  <AppLayout>
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Credentials</h1>
      <p class="text-sm text-gray-400">Securely stored secrets used by workflow nodes</p>
    </header>

    <main class="flex-1 overflow-y-auto p-6">
      <div class="mx-auto max-w-3xl">
        <CredentialList />
      </div>
    </main>
  </AppLayout>
</template>
