import { useCallback, useState } from "react";

const STORAGE_KEY = "openkeyboard.recent-colors";
const MAXIMUM_RECENT_COLORS = 12;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

export const STARTING_RECENT_COLORS: readonly string[] = [
  "#000000",
  "#0000ff",
  "#00ffff",
  "#00ff00",
  "#ffff00",
  "#ff0000",
  "#ff00ff",
  "#ffffff",
  "#ffb3c6",
  "#b3f0c0",
  "#b3d9ff",
  "#fff3a3",
];

export function withRecentColor(colors: readonly string[], color: string): string[] {
  const normalized = color.toLowerCase();
  return [normalized, ...colors.filter((existing) => existing !== normalized)].slice(0, MAXIMUM_RECENT_COLORS);
}

export function useRecentColors() {
  const [colors, setColors] = useState<readonly string[]>(readStoredColors);
  const remember = useCallback((color: string) => {
    setColors((current) => {
      const next = withRecentColor(current, color);
      storeColors(next);
      return next;
    });
  }, []);
  return { colors, remember };
}

function readStoredColors(): readonly string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return STARTING_RECENT_COLORS;
    const valid = stored.filter((color): color is string => typeof color === "string" && HEX_COLOR_PATTERN.test(color));
    return valid.length > 0 ? valid.slice(0, MAXIMUM_RECENT_COLORS) : STARTING_RECENT_COLORS;
  } catch {
    return STARTING_RECENT_COLORS;
  }
}

function storeColors(colors: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    return;
  }
}
