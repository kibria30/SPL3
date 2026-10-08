import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "theme";

// The <html class="dark"> flag is the single source of truth (set before paint by the inline
// script in app/layout.tsx), so components subscribe to it with a MutationObserver.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
