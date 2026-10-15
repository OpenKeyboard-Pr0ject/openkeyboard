import type { ComponentType, SVGProps } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "../components/icons";
import { THEME_PREFERENCES, type ThemePreference } from "./theme-preference";
import type { ThemeControl } from "./use-theme";

export const PREFERENCE_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const PREFERENCE_ICONS: Readonly<Record<ThemePreference, ComponentType<SVGProps<SVGSVGElement>>>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function ThemeSwitcher({ control }: { readonly control: ThemeControl }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-md bg-sunken p-1">
      {THEME_PREFERENCES.map((preference) => {
        const PreferenceIcon = PREFERENCE_ICONS[preference];
        const isSelected = control.preference === preference;
        return (
          <button
            key={preference}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={PREFERENCE_LABELS[preference]}
            onClick={() => control.setPreference(preference)}
            className={[
              "flex h-8 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm font-semibold transition",
              "focus-visible:outline-2 focus-visible:outline-accent",
              isSelected ? "bg-tint-strong text-strong" : "text-muted hover:text-strong",
            ].join(" ")}
          >
            <PreferenceIcon width={15} height={15} />
            <span>{PREFERENCE_LABELS[preference]}</span>
          </button>
        );
      })}
    </div>
  );
}
