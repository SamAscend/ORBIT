"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";

export type ThemePreference = "light" | "dark" | "system";

const storageKey = "orbit-theme-v1";
const themeChangeEvent = "orbit-theme-change";
let memoryTheme: ThemePreference | null = null;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function getThemePreference(): ThemePreference {
  if (memoryTheme) return memoryTheme;
  try {
    const savedTheme = window.localStorage.getItem(storageKey);
    if (isThemePreference(savedTheme)) {
      memoryTheme = savedTheme;
      return savedTheme;
    }
  } catch (error) {
    console.error("Could not read the saved ORBIT appearance preference.", error);
  }
  return "system";
}

function subscribeToTheme(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) memoryTheme = null;
    callback();
  };
  window.addEventListener(themeChangeEvent, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(themeChangeEvent, callback);
    window.removeEventListener("storage", onStorage);
  };
}

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore<ThemePreference>(subscribeToTheme, getThemePreference, () => "system");

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    memoryTheme = nextPreference;
    try {
      window.localStorage.setItem(storageKey, nextPreference);
    } catch (error) {
      console.error("Could not save the ORBIT appearance preference.", error);
    }
    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme = preference === "system" ? mediaQuery.matches ? "dark" : "light" : preference;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [preference]);

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider.");
  return context;
}

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  const { t } = useLanguage();
  const preferences: ThemePreference[] = ["light", "dark", "system"];
  const currentIndex = preferences.indexOf(preference);
  const nextPreference = preferences[(currentIndex + 1) % preferences.length];
  const labels: Record<ThemePreference, string> = {
    light: "Light mode",
    dark: "Dark mode",
    system: "System mode",
  };
  const actions: Record<ThemePreference, string> = {
    light: "Switch to light mode",
    dark: "Switch to dark mode",
    system: "Switch to system mode",
  };

  return <button
    type="button"
    className="theme-switcher"
    aria-label={`${t("Appearance")}: ${t(labels[preference])}. ${t(actions[nextPreference])}`}
    title={`${t("Appearance")}: ${t(labels[preference])}`}
    onClick={() => setPreference(nextPreference)}
  >
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {preference === "light"
        ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>
        : preference === "dark"
          ? <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
          : <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>}
    </svg>
    <span>{t(labels[preference])}</span>
  </button>;
}
