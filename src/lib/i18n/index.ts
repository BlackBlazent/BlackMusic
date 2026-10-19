import { useCallback } from "react";
import { useSharedSetting } from "@/lib/sharedSetting";
import { en, type Catalog } from "./locales/en";
import { de } from "./locales/de";
import { ja } from "./locales/ja";
import { pt_BR } from "./locales/pt-BR";
import { hi } from "./locales/hi";
import { fr } from "./locales/fr";
import { es } from "./locales/es";

/**
 * Offline i18n. Catalogs are bundled TypeScript objects (no network, no extra runtime dependency), English is the
 * source of truth and every other language falls back to it key-by-key — a half-translated language never shows blanks.
 * Add a language: create locales/<code>.ts typed as Catalog, then register it below.
 */
export type TKey = keyof Catalog;

export interface LanguageInfo {
  code: string;
  /** Name in its own language. */
  native: string;
  english: string;
  /** BCP-47 tag used for number/date formatting. */
  locale: string;
  catalog: Partial<Catalog>;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", native: "English", english: "English", locale: "en-US", catalog: en },
  { code: "de", native: "Deutsch", english: "German", locale: "de-DE", catalog: de },
  { code: "ja", native: "日本語", english: "Japanese", locale: "ja-JP", catalog: ja },
  { code: "pt-BR", native: "Português (Brasil)", english: "Portuguese (Brazil)", locale: "pt-BR", catalog: pt_BR },
  { code: "en-IN", native: "English (India)", english: "English (India)", locale: "en-IN", catalog: en },
  { code: "hi", native: "हिन्दी", english: "Hindi", locale: "hi-IN", catalog: hi },
  { code: "fr", native: "Français", english: "French", locale: "fr-FR", catalog: fr },
  { code: "es", native: "Español", english: "Spanish", locale: "es-ES", catalog: es },
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

/** First launch: pick the OS language when we support it, otherwise English. */
export function detectLanguage(): string {
  const tags = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const tag of tags) {
    if (byCode.has(tag)) return tag;
    const base = tag.split("-")[0];
    if (byCode.has(base)) return base;
  }
  return "en";
}

export function useLanguage(): [string, (code: string) => void] {
  const [code, setCode] = useSharedSetting<string>("language", "en");
  return [byCode.has(code) ? code : "en", setCode];
}

/** `const t = useT(); t("nav.home")` — re-renders when the language changes. `{name}` placeholders are supported. */
export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const [code] = useLanguage();
  return useCallback(
    (key, vars) => {
      const text = byCode.get(code)?.catalog[key] ?? en[key] ?? key;
      return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
    },
    [code],
  );
}

export function useLocaleTag(): string {
  const [code] = useLanguage();
  return byCode.get(code)?.locale ?? "en-US";
}
