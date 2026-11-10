import { useSyncExternalStore } from "react";

/** What the user chose. "system" (the default) follows the OS and keeps
 *  following it when it changes; "light" / "dark" are explicit overrides. */
export type ThemePreference = "system" | "light" | "dark";
export type Theme = "dark" | "light";

const KEY = "teachtalk_theme";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const systemTheme = (): Theme => (media && !media.matches ? "light" : "dark");

let preference: ThemePreference = typeof window === "undefined" ? "system" : readPreference();
const resolve = (): Theme => (preference === "system" ? systemTheme() : preference);
let current: Theme = typeof window === "undefined" ? "dark" : resolve();
const listeners = new Set<() => void>();

function apply() {
  current = resolve();
  document.documentElement.classList.toggle("dark", current === "dark");
  listeners.forEach((l) => l());
}

export function initTheme() {
  preference = readPreference();
  apply();
  // Follow the OS live (e.g. automatic dark mode at night) unless overridden.
  media?.addEventListener("change", () => {
    if (preference === "system") apply();
  });
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: the choice just will not survive a reload */
  }
  apply();
}

export function toggleTheme() {
  setThemePreference(current === "dark" ? "light" : "dark");
}

const subscribe = (cb: () => void) => (listeners.add(cb), () => listeners.delete(cb));

/** The theme actually in effect. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current, () => "dark" as Theme);
}

/** The user's setting, which may be "system". */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference, () => "system" as ThemePreference);
}
