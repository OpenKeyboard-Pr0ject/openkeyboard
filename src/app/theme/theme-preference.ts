export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

const STORAGE_KEY = "openkeyboard.theme";

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function readStoredPreference(storage: Pick<Storage, "getItem"> | undefined): ThemePreference {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    return THEME_PREFERENCES.find((preference) => preference === stored) ?? "system";
  } catch {
    return "system";
  }
}

export function storePreference(storage: Pick<Storage, "setItem"> | undefined, preference: ThemePreference): void {
  try {
    storage?.setItem(STORAGE_KEY, preference);
  } catch {
    return;
  }
}

export function applyTheme(root: HTMLElement, theme: Theme): void {
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}
