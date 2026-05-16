<script setup lang="ts">
import { ref, computed } from "vue";
import type { IntegrationTemplate } from "../../../shared/api/integrations.js";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  templates: IntegrationTemplate[];
  loading?: boolean;
  installing?: string | null; // templateId currently being installed
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  installing: null,
});

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  install: [templateId: string, workflowName: string];
  search: [query: string];
}>();

// ─── Local state ──────────────────────────────────────────────────────────────

const searchQuery      = ref("");
const selectedCategory = ref("");
const selectedSort     = ref<"installs" | "rating" | "newest">("installs");
const officialOnly     = ref(false);

// Install-rename dialog state
const pendingInstallId   = ref<string | null>(null);
const pendingInstallName = ref("");

// ─── Derived ──────────────────────────────────────────────────────────────────

const filteredTemplates = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  return props.templates.filter((t) => {
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q));
    const matchesCategory = !selectedCategory.value || t.category === selectedCategory.value;
    const matchesOfficial = !officialOnly.value || t.isOfficial;
    return matchesSearch && matchesCategory && matchesOfficial;
  });
});

const sortedTemplates = computed(() => {
  const list = [...filteredTemplates.value];
  if (selectedSort.value === "installs") return list.sort((a, b) => b.installCount - a.installCount);
  if (selectedSort.value === "rating")   return list.sort((a, b) => b.rating - a.rating);
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});

const categories = computed(() => {
  const cats = new Set(props.templates.map((t) => t.category).filter(Boolean));
  return [...cats];
});

// ─── Handlers ────────────────────────────────────────────────────────────────

function onSearchInput(event: Event): void {
  searchQuery.value = (event.target as HTMLInputElement).value;
  emit("search", searchQuery.value);
}

function openInstallDialog(template: IntegrationTemplate): void {
  pendingInstallId.value   = template.templateId;
  pendingInstallName.value = template.name;
}

function cancelInstall(): void {
  pendingInstallId.value   = null;
  pendingInstallName.value = "";
}

function confirmInstall(): void {
  if (!pendingInstallId.value) return;
  emit("install", pendingInstallId.value, pendingInstallName.value.trim());
  pendingInstallId.value   = null;
  pendingInstallName.value = "";
}

function formatRating(rating: number): string {
  return rating > 0 ? rating.toFixed(1) : "—";
}
</script>

<template>
  <div data-testid="integrations-browser">

    <!-- Filters bar -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        class="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        type="search"
        placeholder="Search integrations…"
        :value="searchQuery"
        data-testid="integrations-search"
        aria-label="Search integration templates"
        @input="onSearchInput"
      />

      <select
        v-model="selectedCategory"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        data-testid="integrations-category-filter"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select
        v-model="selectedSort"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        data-testid="integrations-sort"
        aria-label="Sort templates"
      >
        <option value="installs">Most used</option>
        <option value="rating">Top rated</option>
        <option value="newest">Newest</option>
      </select>

      <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-600 select-none">
        <input
          v-model="officialOnly"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 accent-violet-600"
          data-testid="official-only-toggle"
          aria-label="Show official templates only"
        />
        Official only
      </label>
    </div>

    <!-- Skeleton -->
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="integrations-skeleton"
    >
      <div v-for="i in 6" :key="i" class="h-44 animate-pulse rounded-xl bg-gray-100" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="sortedTemplates.length === 0"
      class="py-16 text-center text-gray-400"
      data-testid="integrations-empty"
    >
      No integration templates found.
    </div>

    <!-- Template cards grid -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="template in sortedTemplates"
        :key="template.templateId"
        class="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        data-testid="integration-card"
      >
        <div>
          <!-- Header -->
          <div class="mb-2 flex items-start justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-800 leading-snug" data-testid="integration-name">
              {{ template.name }}
            </h3>
            <span
              v-if="template.isOfficial"
              class="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700"
              data-testid="official-badge"
            >
              Official
            </span>
          </div>

          <!-- Description -->
          <p class="mb-3 line-clamp-2 text-xs text-gray-500" data-testid="integration-description">
            {{ template.description || "No description provided." }}
          </p>

          <!-- Node type chips -->
          <div class="mb-3 flex flex-wrap gap-1" data-testid="required-node-types">
            <span
              v-for="nodeType in template.requiredNodeTypes.slice(0, 4)"
              :key="nodeType"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
            >
              {{ nodeType }}
            </span>
            <span
              v-if="template.requiredNodeTypes.length > 4"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400"
            >
              +{{ template.requiredNodeTypes.length - 4 }} more
            </span>
          </div>

          <!-- Stats row -->
          <div class="flex flex-wrap gap-2 text-xs text-gray-400">
            <span data-testid="integration-author">by {{ template.author }}</span>
            <span aria-hidden="true">·</span>
            <span data-testid="integration-installs">{{ template.installCount }} uses</span>
            <span aria-hidden="true">·</span>
            <span data-testid="integration-rating">{{ formatRating(template.rating) }} rating</span>
          </div>
        </div>

        <!-- Action -->
        <button
          class="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="installing === template.templateId"
          data-testid="use-template-button"
          :aria-label="`Use template: ${template.name}`"
          @click="openInstallDialog(template)"
        >
          {{ installing === template.templateId ? "Installing…" : "Use Template" }}
        </button>
      </article>
    </div>

    <!-- Install / rename dialog -->
    <Teleport to="body">
      <div
        v-if="pendingInstallId"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-dialog-title"
        data-testid="install-dialog"
        @keydown.esc="cancelInstall"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 id="install-dialog-title" class="mb-1 text-base font-semibold text-gray-900">
            Add to your workflows
          </h2>
          <p class="mb-4 text-sm text-gray-500">
            A copy of this template will be added as a draft workflow. You can rename it before adding.
          </p>

          <label class="mb-1 block text-xs font-medium text-gray-700" for="workflow-name-input">
            Workflow name
          </label>
          <input
            id="workflow-name-input"
            v-model="pendingInstallName"
            class="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            type="text"
            data-testid="workflow-name-input"
            @keydown.enter="confirmInstall"
          />

          <div class="flex justify-end gap-3">
            <button
              class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              data-testid="cancel-install-btn"
              @click="cancelInstall"
            >
              Cancel
            </button>
            <button
              class="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              :disabled="!pendingInstallName.trim()"
              data-testid="confirm-install-btn"
              @click="confirmInstall"
            >
              Add Workflow
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
