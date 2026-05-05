<script setup lang="ts">
import { ref, watch } from "vue";
import type { Template } from "../../shared/api/templates.js";

interface Props {
  templateId: string | null;
  cloning?: boolean;
}

const props = withDefaults(defineProps<Props>(), { cloning: false });

const emit = defineEmits<{
  close: [];
  clone: [id: string];
}>();

const template = ref<Template | null>(null);
const loading  = ref(false);

watch(
  () => props.templateId,
  async (id) => {
    if (!id) { template.value = null; return; }
    loading.value = true;
    try {
      const { getTemplate } = await import("../../shared/api/templates.js");
      template.value = await getTemplate(id);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

function nodeIcon(type: string): string {
  const icons: Record<string, string> = {
    webhook_trigger:  "🔗",
    schedule_trigger: "⏰",
    // Legacy aliases
    webhookTrigger:   "🔗",
    scheduleTrigger:  "⏰",
    httpRequest:     "🌐",
    email:           "✉️",
    conditional:     "🔀",
    aiTransform:     "🤖",
    database:        "🗄️",
    function:        "ƒ",
    wait:            "⏱️",
    loop:            "🔁",
    merge:           "🔗",
  };
  return icons[type] ?? "⚡";
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="templateId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div class="relative w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div v-if="loading" class="h-5 w-48 bg-neutral-200 animate-pulse rounded" />
          <div v-else-if="template" class="flex flex-col gap-0.5">
            <h2 class="font-semibold text-neutral-900">{{ template.name }}</h2>
            <p class="text-xs text-neutral-500">{{ template.category }} · by {{ template.author }}</p>
          </div>
          <button
            class="text-neutral-400 hover:text-neutral-900 transition-colors"
            @click="emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="h-16 bg-neutral-100 animate-pulse rounded-lg" />
          </div>

          <template v-else-if="template">
            <!-- Description -->
            <p class="text-sm text-neutral-600 mb-6">{{ template.description }}</p>

            <!-- Node flow preview -->
            <div class="mb-6">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-3">Workflow Nodes</h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="(node, index) in template.nodes"
                  :key="node.id"
                  class="flex items-center gap-3"
                >
                  <!-- Connector line -->
                  <div v-if="index > 0" class="absolute -mt-4 ml-5 w-0.5 h-4 bg-neutral-300" />
                  <div class="flex items-center gap-3 w-full px-4 py-3 rounded-lg border border-neutral-200 bg-neutral-50">
                    <span class="text-xl shrink-0">{{ nodeIcon(node.type) }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-neutral-800 truncate">{{ node.label }}</p>
                      <p class="text-xs text-neutral-500">{{ node.type }}</p>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 shrink-0">
                      {{ node.category }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="template.tags.length > 0" class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in template.tags"
                :key="tag"
                class="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600"
              >
                {{ tag }}
              </span>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50">
          <div v-if="template" class="text-xs text-neutral-500">
            {{ template.usageCount.toLocaleString() }} uses
          </div>
          <div class="flex gap-3">
            <button
              class="text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="text-sm font-medium px-5 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors disabled:opacity-50"
              :disabled="cloning || !template"
              @click="template && emit('clone', template.id)"
            >
              {{ cloning ? "Cloning…" : "Use This Template" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
