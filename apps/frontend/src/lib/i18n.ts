import { useSyncExternalStore } from "react";
import { en, type Keys } from "../locales/en";
import { fr } from "../locales/fr";

/* Two languages, no dependency. English is the source: every French key is
   checked against it by the compiler, so a missing translation cannot ship. */

export type Lang = "en" | "fr";
export const LANGUAGES: Array<{ id: Lang; label: string }> = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const KEY = "teachtalk_lang";
const dictionaries: Record<Lang, Record<Keys, string>> = { en, fr };

function detect(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    /* fall through to the browser language */
  }
  const nav = typeof navigator !== "undefined" ? navigator.languages?.[0] ?? navigator.language ?? "en" : "en";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

let current: Lang = typeof window === "undefined" ? "en" : detect();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document !== "undefined") document.documentElement.lang = current;
  listeners.forEach((l) => l());
}

export function initLang() {
  current = detect();
  apply();
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* the choice just will not survive a reload */
  }
  apply();
}

export function getLang(): Lang {
  return current;
}

/** Looks a key up in a language, filling {name}-style placeholders. */
export function translate(lang: Lang, key: Keys, vars?: Record<string, string | number>): string {
  const text = dictionaries[lang][key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : text;
}

export type T = (key: Keys, vars?: Record<string, string | number>) => string;

const subscribe = (cb: () => void) => (listeners.add(cb), () => listeners.delete(cb));

/** The current language and a `t` bound to it; components re-render when it changes. */
export function useI18n(): { lang: Lang; t: T; setLang: (l: Lang) => void } {
  const lang = useSyncExternalStore(subscribe, () => current, () => "en" as Lang);
  return { lang, t: (key, vars) => translate(lang, key, vars), setLang };
}

/** For code outside React (toasts, helpers). */
export const t: T = (key, vars) => translate(current, key, vars);

/** Locale for dates and numbers. */
export const dateLocale = (lang: Lang) => (lang === "fr" ? "fr-FR" : "en-US");
