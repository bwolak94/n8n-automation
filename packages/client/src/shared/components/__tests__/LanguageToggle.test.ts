import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import LanguageToggle from "../LanguageToggle.vue";
import { en } from "../../i18n/en/index.js";
import { pl } from "../../i18n/pl/index.js";
import type { EnMessages } from "../../i18n/en/index.js";
import type { SupportedLocale } from "../../i18n/index.js";
import { LOCALE_STORAGE_KEY } from "../../i18n/index.js";

function makeI18n(locale: SupportedLocale = "en") {
  return createI18n<[EnMessages], SupportedLocale>({
    legacy: false,
    locale,
    fallbackLocale: "en",
    messages: { en, pl },
  });
}

describe("LanguageToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders language buttons", () => {
    const wrapper = mount(LanguageToggle, {
      global: { plugins: [makeI18n()] },
    });

    expect(wrapper.find("[data-testid='lang-en']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='lang-pl']").exists()).toBe(true);
  });

  it("marks the active locale button with aria-pressed=true", () => {
    const wrapper = mount(LanguageToggle, {
      global: { plugins: [makeI18n("en")] },
    });

    const enBtn = wrapper.find("[data-testid='lang-en']");
    expect(enBtn.attributes("aria-pressed")).toBe("true");

    const plBtn = wrapper.find("[data-testid='lang-pl']");
    expect(plBtn.attributes("aria-pressed")).toBe("false");
  });

  it("persists locale to localStorage when language is selected", async () => {
    const i18n = makeI18n("en");
    const wrapper = mount(LanguageToggle, {
      global: { plugins: [i18n] },
    });

    await wrapper.find("[data-testid='lang-pl']").trigger("click");

    expect(localStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, "pl");
  });

  it("toggle button switches between en and pl", async () => {
    const i18n = makeI18n("en");
    const wrapper = mount(LanguageToggle, {
      global: { plugins: [i18n] },
    });

    await wrapper.find("[data-testid='toggle-btn']").trigger("click");

    expect(localStorage.setItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, "pl");
  });

  it("shows current locale code in toggle button", () => {
    const wrapper = mount(LanguageToggle, {
      global: { plugins: [makeI18n("en")] },
    });

    expect(wrapper.find("[data-testid='toggle-btn']").text()).toBe("EN");
  });
});
