import { useCallback, useSyncExternalStore } from "react";

export type ViewMode = "list" | "cards";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// The chosen view is remembered per page in localStorage; "list" is the default (and what the server renders).
export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const mode = useSyncExternalStore<ViewMode>(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) === "cards" ? "cards" : "list";
      } catch {
        return "list";
      }
    },
    () => "list",
  );

  const setMode = useCallback(
    (next: ViewMode) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {}
      listeners.forEach((l) => l());
    },
    [storageKey],
  );

  return [mode, setMode];
}
