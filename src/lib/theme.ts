import { useEffect } from "react";
import { useSettingsStore, type ThemePreference } from "@/store/useSettingsStore";

function resolveIsDark(theme: ThemePreference): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", resolveIsDark(theme));
}

/**
 * Applies the persisted theme preference to <html class="dark">, and keeps
 * it in sync with the OS preference while "system" is selected. Mount once
 * near the app root — index.html carries a matching inline script so the
 * correct theme is already applied before this effect's first run, avoiding
 * a light-mode flash on a dark-preferring reload.
 */
export function useThemeEffect() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    applyThemeClass(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeClass(theme);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}
