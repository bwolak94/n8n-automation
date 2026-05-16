<script setup lang="ts">
import type { TemplateSummary } from "../../shared/api/templates.js";

interface Props {
  template: TemplateSummary;
  cloning?: boolean;
}

withDefaults(defineProps<Props>(), { cloning: false });

const emit = defineEmits<{
  preview: [id: string];
  clone:   [id: string];
}>();

const CATEGORY_COLORS: Record<string, string> = {
  Notifications:   "bg-blue-100 text-blue-800",
  "Data Processing": "bg-purple-100 text-purple-800",
  CRM:             "bg-green-100 text-green-800",
  DevOps:          "bg-orange-100 text-orange-800",
  Finance:         "bg-yellow-100 text-yellow-800",
  AI:              "bg-pink-100 text-pink-800",
  Utilities:       "bg-gray-100 text-gray-800",
};

function categoryClass(category: string): string {
  return CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-800";
}

function stars(rating: number): string {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return "★".repeat(full) + "☆".repeat(empty);
}
</script>

<template>
  <div
    class="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    @click="emit('preview', template.id)"
  >
    <!-- Thumbnail / placeholder -->
    <div class="flex items-center justify-center h-32 rounded-t-xl bg-gradient-to-br from-neutral-100 to-neutral-200 overflow-hidden">
      <img
        v-if="template.thumbnail"
        :src="template.thumbnail"
        :alt="template.name"
        class="w-full h-full object-cover"
      />
      <span v-else class="text-4xl select-none">⚡</span>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-2 p-4 flex-1">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold text-neutral-900 text-sm leading-tight line-clamp-2">
          {{ template.name }}
        </h3>
        <span
          class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
          :class="categoryClass(template.category)"
        >
          {{ template.category }}
        </span>
      </div>

      <p class="text-xs text-neutral-500 line-clamp-2">{{ template.description }}</p>

      <!-- Tags -->
      <div v-if="template.tags.length > 0" class="flex flex-wrap gap-1">
        <span
          v-for="tag in template.tags.slice(0, 3)"
          :key="tag"
          class="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600"
        >
          {{ tag }}
        </span>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
      <div class="flex items-center gap-3 text-xs text-neutral-500">
        <span class="text-yellow-500">{{ stars(template.rating) }}</span>
        <span>{{ template.usageCount.toLocaleString() }} uses</span>
      </div>
      <button
        class="text-xs font-medium px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
        :disabled="cloning"
        @click.stop="emit('clone', template.id)"
      >
        {{ cloning ? "Cloning…" : "Use Template" }}
      </button>
    </div>
  </div>
</template>
