import { useEffect, useState } from "react";
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  type Theme,
  type ThemePreference,
} from "./theme-preference";

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export interface ThemeControl {
  readonly preference: ThemePreference;
  readonly theme: Theme;
  setPreference(preference: ThemePreference): void;
}

export function useTheme(): ThemeControl {
  const [preference, setPreference] = useState<ThemePreference>(() => readStoredPreference(browserStorage()));
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia(DARK_SCHEME_QUERY).matches);
  const theme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => applyTheme(document.documentElement, theme), [theme]);
  useEffect(() => storePreference(browserStorage(), preference), [preference]);

  return { preference, theme, setPreference };
}

function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
