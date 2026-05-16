import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createI18n } from "vue-i18n";
import { useTranslation } from "../../composables/useTranslation.js";
import { en } from "../en/index.js";
import { pl } from "../pl/index.js";
import type { EnMessages } from "../en/index.js";
import type { SupportedLocale } from "../index.js";

// ─── Test i18n instance ───────────────────────────────────────────────────────

function makeI18n(locale: SupportedLocale = "en") {
  return createI18n<[EnMessages], SupportedLocale>({
    legacy: false,
    locale,
    fallbackLocale: "en",
    messages: { en, pl },
  });
}

function mountWithTranslation<N extends keyof EnMessages>(
  namespace: N,
  locale: SupportedLocale = "en"
) {
  const i18n = makeI18n(locale);
  let result: ReturnType<typeof useTranslation<N>> | null = null;

  const TestComponent = defineComponent({
    setup() {
      result = useTranslation(namespace);
      return {};
    },
    template: "<div />",
  });

  mount(TestComponent, { global: { plugins: [i18n] } });
  return result!;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useTranslation", () => {
  describe("EN locale", () => {
    it("returns correct string for common.save", () => {
      const { t } = mountWithTranslation("common", "en");
      expect(t("save")).toBe("Save");
    });

    it("returns correct string for common.cancel", () => {
      const { t } = mountWithTranslation("common", "en");
      expect(t("cancel")).toBe("Cancel");
    });

    it("returns correct string for canvas.addNode", () => {
      const { t } = mountWithTranslation("canvas", "en");
      expect(t("addNode")).toBe("Add node");
    });

    it("returns correct string for executions.title", () => {
      const { t } = mountWithTranslation("executions", "en");
      expect(t("title")).toBe("Executions");
    });

    it("returns correct string for nodes.triggers", () => {
      const { t } = mountWithTranslation("nodes", "en");
      expect(t("triggers")).toBe("Triggers");
    });
  });

  describe("PL locale", () => {
    it("returns correct Polish string for common.save", () => {
      const { t } = mountWithTranslation("common", "pl");
      expect(t("save")).toBe("Zapisz");
    });

    it("returns correct Polish string for common.cancel", () => {
      const { t } = mountWithTranslation("common", "pl");
      expect(t("cancel")).toBe("Anuluj");
    });

    it("returns correct Polish string for canvas.addNode", () => {
      const { t } = mountWithTranslation("canvas", "pl");
      expect(t("addNode")).toBe("Dodaj węzeł");
    });

    it("returns correct Polish string for executions.title", () => {
      const { t } = mountWithTranslation("executions", "pl");
      expect(t("title")).toBe("Wykonania");
    });
  });

  describe("locale ref", () => {
    it("exposes the current locale", () => {
      const { locale } = mountWithTranslation("common", "en");
      expect(locale.value).toBe("en");
    });
  });
});
