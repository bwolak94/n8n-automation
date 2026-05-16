<script setup lang="ts">
import { useRouter } from "vue-router";
import AppLayout from "../shared/components/AppLayout.vue";
import TemplateGallery from "../features/templates/TemplateGallery.vue";

const router = useRouter();

function onCloned(workflowId: string): void {
  void router.push({ name: "canvas", params: { id: workflowId } });
}
</script>

<template>
  <AppLayout>
    <header class="border-b border-gray-200 bg-white px-6 py-4">
      <h1 class="text-lg font-semibold text-gray-900">Templates</h1>
      <p class="text-sm text-gray-400">Start from a pre-built workflow template</p>
    </header>

    <main class="flex-1 overflow-y-auto p-6">
      <TemplateGallery @cloned="onCloned" />
    </main>
  </AppLayout>
</template>
