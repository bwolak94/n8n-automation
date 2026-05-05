<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useTemplates } from "./useTemplates.js";
import TemplateCard from "./TemplateCard.vue";
import TemplatePreview from "./TemplatePreview.vue";

const emit = defineEmits<{
  cloned: [workflowId: string, name: string];
}>();

const CATEGORIES = [
  "Notifications",
  "Data Processing",
  "CRM",
  "DevOps",
  "Finance",
  "AI",
  "Utilities",
];

const { templates, total, loading, error, cloning, fetchTemplates, clone } = useTemplates();

const search           = ref("");
const selectedCategory = ref("");
const previewId        = ref<string | null>(null);
const searchTimer      = ref<ReturnType<typeof setTimeout> | null>(null);

onMounted(() => fetchTemplates());

function onSearchInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  search.value = value;

  if (searchTimer.value) clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(() => {
    fetchTemplates({ search: value || undefined, category: selectedCategory.value || undefined });
  }, 300);
}

function selectCategory(cat: string): void {
  selectedCategory.value = cat === selectedCategory.value ? "" : cat;
  fetchTemplates({ search: search.value || undefined, category: selectedCategory.value || undefined });
}

function openPreview(id: string): void {
  previewId.value = id;
}

function closePreview(): void {
  previewId.value = null;
}

async function handleClone(templateId: string): Promise<void> {
  previewId.value = null;
  const result = await clone(templateId);
  if (result) {
    emit("cloned", result.workflowId, result.name);
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-6 py-5 border-b border-neutral-200">
      <h1 class="text-xl font-semibold text-neutral-900 mb-4">Template Library</h1>

      <!-- Search -->
      <div class="relative mb-4">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
          fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search templates…"
          class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-neutral-200 bg-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
          @input="onSearchInput"
        />
      </div>

      <!-- Category pills -->
      <div class="flex flex-wrap gap-2">
        <button
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="selectedCategory === '' ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'"
          @click="selectCategory('')"
        >
          All
        </button>
        <button
          v-for="cat in CATEGORIES"
          :key="cat"
          class="text-xs px-3 py-1.5 rounded-full border transition-colors"
          :class="selectedCategory === cat ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'"
          @click="selectCategory(cat)"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Error -->
      <div v-if="error" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
        {{ error }}
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading && templates.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="i in 6"
          :key="i"
          class="h-52 rounded-xl bg-neutral-100 animate-pulse"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else-if="!loading && templates.length === 0"
        class="flex flex-col items-center justify-center py-24 text-center"
      >
        <span class="text-5xl mb-4">📭</span>
        <p class="text-neutral-500 text-sm">No templates found. Try a different search or category.</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <TemplateCard
          v-for="template in templates"
          :key="template.id"
          :template="template"
          :cloning="cloning === template.id"
          @preview="openPreview"
          @clone="handleClone"
        />
      </div>

      <!-- Count -->
      <p v-if="total > 0" class="text-xs text-neutral-400 text-center mt-6">
        Showing {{ templates.length }} of {{ total }} templates
      </p>
    </div>

    <!-- Preview modal -->
    <TemplatePreview
      :template-id="previewId"
      :cloning="!!cloning"
      @close="closePreview"
      @clone="handleClone"
    />
  </div>
</template>
