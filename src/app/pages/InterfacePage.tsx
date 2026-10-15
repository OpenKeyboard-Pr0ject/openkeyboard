import { Card } from "../components/Card";
import { RadioList } from "../components/inputs";
import { PageHeader } from "../components/PageHeader";
import { THEME_PREFERENCES } from "../theme/theme-preference";
import { PREFERENCE_ICONS, PREFERENCE_LABELS } from "../theme/ThemeSwitcher";
import type { ThemeControl } from "../theme/use-theme";

export function InterfacePage({ theme }: { readonly theme: ThemeControl }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Interface" description="How OpenKeyboard looks on this computer." />
      <Card title="Theme" description="System follows the light or dark setting of your computer.">
        <div className="max-w-xl">
          <RadioList
            label="Theme"
            selected={theme.preference}
            onSelect={theme.setPreference}
            choices={THEME_PREFERENCES.map((preference) => {
              const PreferenceIcon = PREFERENCE_ICONS[preference];
              return {
                value: preference,
                label: PREFERENCE_LABELS[preference],
                icon: <PreferenceIcon width={16} height={16} className="text-muted" />,
              };
            })}
          />
        </div>
      </Card>
    </div>
  );
}
