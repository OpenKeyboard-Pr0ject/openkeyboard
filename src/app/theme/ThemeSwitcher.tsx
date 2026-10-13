import type { ComponentType, SVGProps } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "../components/icons";
import { THEME_PREFERENCES, type ThemePreference } from "./theme-preference";
import type { ThemeControl } from "./use-theme";

const PREFERENCE_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const PREFERENCE_ICONS: Readonly<Record<ThemePreference, ComponentType<SVGProps<SVGSVGElement>>>> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function ThemeSwitcher({ control }: { readonly control: ThemeControl }) {
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-lg border border-line bg-raised p-0.5">
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
              "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition",
              "focus-visible:outline-2 focus-visible:outline-accent",
              isSelected ? "bg-panel font-semibold text-fg shadow-sm" : "text-muted hover:text-fg",
            ].join(" ")}
          >
            <PreferenceIcon width={14} height={14} />
            <span>{PREFERENCE_LABELS[preference]}</span>
          </button>
        );
      })}
    </div>
  );
}
