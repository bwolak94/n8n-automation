<script setup lang="ts">
import { ref, computed } from "vue";
import type { MarketplacePackage } from "../../../shared/api/marketplace.js";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  packages: MarketplacePackage[];
  installedPackageIds?: string[];
  loading?: boolean;
  installing?: string | null; // packageId currently being installed
}

const props = withDefaults(defineProps<Props>(), {
  installedPackageIds: () => [],
  loading: false,
  installing: null,
});

// ─── Emits ────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  install: [packageId: string];
  search: [query: string];
}>();

// ─── Local state ──────────────────────────────────────────────────────────────

const searchQuery = ref("");
const selectedCategory = ref("");
const selectedSort = ref<"downloads" | "rating" | "newest">("downloads");

// ─── Derived ──────────────────────────────────────────────────────────────────

const installedSet = computed(() => new Set(props.installedPackageIds));

const filteredPackages = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  return props.packages.filter((pkg) => {
    const matchesSearch =
      !q ||
      pkg.name.toLowerCase().includes(q) ||
      (pkg.description ?? "").toLowerCase().includes(q) ||
      (pkg.nodeType ?? "").toLowerCase().includes(q);
    const matchesCategory = !selectedCategory.value || pkg.category === selectedCategory.value;
    return matchesSearch && matchesCategory;
  });
});

const sortedPackages = computed(() => {
  const list = [...filteredPackages.value];
  if (selectedSort.value === "downloads") return list.sort((a, b) => b.downloads - a.downloads);
  if (selectedSort.value === "rating")    return list.sort((a, b) => b.rating - a.rating);
  // newest — sort by createdAt descending
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
});

const categories = computed(() => {
  const cats = new Set(props.packages.map((p) => p.category).filter(Boolean));
  return [...cats];
});

// ─── Handlers ────────────────────────────────────────────────────────────────

function onSearchInput(event: Event): void {
  searchQuery.value = (event.target as HTMLInputElement).value;
  emit("search", searchQuery.value);
}

function onInstall(packageId: string): void {
  emit("install", packageId);
}

function isInstallable(pkg: MarketplacePackage): boolean {
  return pkg.isBuiltIn || !!(pkg as unknown as { tarballPath?: string }).tarballPath;
}
</script>

<template>
  <div data-testid="marketplace-browser">
    <!-- Search + filters bar -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        class="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm outline-none placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        type="search"
        placeholder="Search nodes..."
        :value="searchQuery"
        data-testid="search-input"
        aria-label="Search marketplace packages"
        @input="onSearchInput"
      />

      <select
        v-model="selectedCategory"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        data-testid="category-filter"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <select
        v-model="selectedSort"
        class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        data-testid="sort-select"
        aria-label="Sort packages"
      >
        <option value="downloads">Most downloaded</option>
        <option value="rating">Top rated</option>
        <option value="newest">Newest</option>
      </select>
    </div>

    <!-- Skeleton state -->
    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="marketplace-skeleton">
      <div v-for="i in 6" :key="i" class="h-36 animate-pulse rounded-xl bg-gray-100" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="sortedPackages.length === 0"
      class="py-16 text-center text-gray-400"
      data-testid="marketplace-empty"
    >
      No packages found.
    </div>

    <!-- Package cards -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="pkg in sortedPackages"
        :key="pkg.packageId"
        class="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        data-testid="package-card"
      >
        <div>
          <div class="mb-2 flex items-start justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-800" data-testid="package-name">
              {{ pkg.name }}
            </h3>
            <span
              v-if="installedSet.has(pkg.packageId)"
              class="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
              data-testid="installed-badge"
            >
              Installed
            </span>
          </div>
          <p class="mb-3 line-clamp-2 text-xs text-gray-500" data-testid="package-description">
            {{ pkg.description || "No description provided." }}
          </p>
          <div class="flex flex-wrap gap-2 text-xs text-gray-400">
            <span data-testid="package-author">by {{ pkg.author }}</span>
            <span aria-hidden="true">·</span>
            <span data-testid="package-downloads">{{ pkg.downloads }} downloads</span>
            <span aria-hidden="true">·</span>
            <span data-testid="package-rating">{{ pkg.rating.toFixed(1) }} rating</span>
          </div>
        </div>

        <!-- Coming Soon badge for packages without an implementation -->
        <span
          v-if="!isInstallable(pkg)"
          class="mt-4 inline-block rounded-lg border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-medium text-gray-400"
          data-testid="coming-soon-badge"
          :title="`${pkg.name} is not yet available — check back soon`"
        >
          Coming Soon
        </span>

        <button
          v-else
          class="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="installedSet.has(pkg.packageId) || installing === pkg.packageId"
          data-testid="install-button"
          :aria-label="`Install ${pkg.name}`"
          @click="onInstall(pkg.packageId)"
        >
          {{ installedSet.has(pkg.packageId) ? "Installed" : installing === pkg.packageId ? "Installing…" : "Install" }}
        </button>
      </article>
    </div>
  </div>
</template>
