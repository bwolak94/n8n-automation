<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { LOCALE_STORAGE_KEY, type SupportedLocale } from "../i18n/index.js";

const { locale } = useI18n({ useScope: "global" });

const locales: { code: SupportedLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
];

const current = computed(() => locale.value as SupportedLocale);

function _persistLocale(code: SupportedLocale): void {
  locale.value = code;
  localStorage.setItem(LOCALE_STORAGE_KEY, code);
  document.documentElement.setAttribute("lang", code);
}

function toggle(): void {
  const next: SupportedLocale = current.value === "en" ? "pl" : "en";
  _persistLocale(next);
}

function selectLocale(code: SupportedLocale): void {
  _persistLocale(code);
}
</script>

<template>
  <div class="flex items-center gap-1" data-testid="language-toggle">
    <button
      v-for="locale in locales"
      :key="locale.code"
      :data-testid="`lang-${locale.code}`"
      :aria-pressed="current === locale.code"
      :class="[
        'rounded px-2 py-1 text-sm font-medium transition-colors',
        current === locale.code
          ? 'bg-brand-500 text-white'
          : 'text-gray-600 hover:bg-gray-100',
      ]"
      @click="selectLocale(locale.code)"
    >
      {{ locale.label }}
    </button>
    <button
      data-testid="toggle-btn"
      class="ml-2 text-xs text-gray-400 underline"
      @click="toggle"
    >
      {{ current.toUpperCase() }}
    </button>
  </div>
</template>
