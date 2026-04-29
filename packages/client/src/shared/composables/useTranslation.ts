import { useI18n } from "vue-i18n";
import type { EnMessages } from "../i18n/en/index.js";

/**
 * Typed translation composable.
 *
 * Usage:
 *   const { t } = useTranslation('common');
 *   t('save')  // typed — TypeScript errors if key is missing
 */
export function useTranslation<N extends keyof EnMessages>(namespace: N) {
  const { t, locale } = useI18n({ useScope: "global" });

  function translate(
    key: Extract<keyof EnMessages[N], string>
  ): string {
    return t(`${namespace}.${key}`);
  }

  return { t: translate, locale };
}

export type UseTranslationReturn<N extends keyof EnMessages> = ReturnType<
  typeof useTranslation<N>
>;
