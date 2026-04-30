import { createI18n, useI18n } from "vue-i18n";
import { en, type EnMessages } from "./en/index.js";
import { pl } from "./pl/index.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const LOCALE_STORAGE_KEY = "automation-hub-lang";
export type SupportedLocale = "en" | "pl";
export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "pl"];

// ─── Locale persistence ───────────────────────────────────────────────────────

function getSavedLocale(): SupportedLocale {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  return saved === "pl" ? "pl" : "en";
}

// ─── i18n instance ────────────────────────────────────────────────────────────

export const i18n = createI18n<[EnMessages], SupportedLocale>({
  legacy: false,
  locale: getSavedLocale(),
  fallbackLocale: "en",
  messages: { en, pl },
});

// ─── Locale switcher ─────────────────────────────────────────────────────────

export function setLocale(locale: SupportedLocale): void {
  // vue-i18n composition mode uses a Ref for locale
  (i18n.global.locale as unknown as { value: SupportedLocale }).value = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.documentElement.setAttribute("lang", locale);
}

export function getCurrentLocale(): SupportedLocale {
  return (i18n.global.locale as unknown as { value: SupportedLocale }).value;
}

// ─── Typed composable (re-exported for convenience) ──────────────────────────

export { useI18n };
