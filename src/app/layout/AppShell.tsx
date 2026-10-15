import { useState } from "react";
import type { ConnectionState, KeyboardConnection } from "../../connection/keyboard-connection";
import { AboutPage } from "../pages/AboutPage";
import { DeviceSettingsPage } from "../pages/device-settings/DeviceSettingsPage";
import { DevicePage } from "../pages/DevicePage";
import { InterfacePage } from "../pages/InterfacePage";
import { KeymapPage } from "../pages/keymap/KeymapPage";
import { LightingPage } from "../pages/lighting/LightingPage";
import { LiveKeysPage } from "../pages/live-keys/LiveKeysPage";
import { ProfilesPage } from "../pages/profiles/ProfilesPage";
import type { ThemeControl } from "../theme/use-theme";
import { DeviceBar } from "./DeviceBar";
import { IconRail } from "./IconRail";
import { NavigationPanel } from "./NavigationPanel";
import { SECTION_ICONS } from "./section-icons";
import {
  navigationFor,
  type Rail,
  railOf,
  railsWithSections,
  type Section,
  type SectionId,
  sectionsOfRail,
} from "./sections";

type ConnectedState = Extract<ConnectionState, { kind: "connected" }>;

interface AppShellProps {
  readonly state: ConnectedState;
  readonly connection: KeyboardConnection;
  readonly theme: ThemeControl;
}

export function AppShell({ state, connection, theme }: AppShellProps) {
  const sections = navigationFor(state.capabilities);
  const [selected, setSelected] = useState<SectionId>(sections[0].id);
  const current = sections.find((section) => section.id === selected) ?? sections[0];
  const rail = railOf(current);
  const railSections = sectionsOfRail(sections, rail);
  const openRail = (next: Rail) => {
    const [firstSection] = sectionsOfRail(sections, next);
    if (firstSection) setSelected(firstSection.id);
  };

  return (
    <div className="flex h-full flex-col bg-app md:flex-row">
      <IconRail rails={railsWithSections(sections)} selected={rail.id} onSelect={openRail} />
      <NavigationPanel
        rail={rail}
        sections={railSections}
        selected={current.id}
        onSelect={setSelected}
        identity={state.identity}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-4 md:px-8 md:py-4">
          <DeviceBar identity={state.identity} />
          <CompactSectionTabs sections={railSections} selected={current.id} onSelect={setSelected} />
          <SectionPage section={current.id} state={state} connection={connection} theme={theme} />
        </div>
      </main>
    </div>
  );
}

interface CompactSectionTabsProps {
  readonly sections: readonly Section[];
  readonly selected: SectionId;
  readonly onSelect: (section: SectionId) => void;
}

function CompactSectionTabs({ sections, selected, onSelect }: CompactSectionTabsProps) {
  return (
    <nav aria-label="Sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:hidden">
      {sections.map((section) => {
        const SectionIcon = SECTION_ICONS[section.id];
        const isSelected = section.id === selected;
        return (
          <button
            key={section.id}
            type="button"
            aria-current={isSelected ? "page" : undefined}
            onClick={() => onSelect(section.id)}
            className={[
              "flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition",
              isSelected ? "bg-tint font-bold text-strong" : "bg-panel text-fg",
            ].join(" ")}
          >
            <SectionIcon width={16} height={16} className={isSelected ? "text-accent-ink" : "text-muted"} />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

interface SectionPageProps {
  readonly section: SectionId;
  readonly state: ConnectedState;
  readonly connection: KeyboardConnection;
  readonly theme: ThemeControl;
}

function SectionPage({ section, state, connection, theme }: SectionPageProps) {
  const { capabilities, identity } = state;
  switch (section) {
    case "profiles":
      return capabilities.profiles
        ? <ProfilesPage reader={capabilities.profiles} editor={capabilities.profileEditor} />
        : null;
    case "keymap":
      return capabilities.keymap
        ? <KeymapPage reader={capabilities.keymap} definitionLoader={capabilities.definitionLoader} />
        : null;
    case "lighting":
      return capabilities.lighting
        ? <LightingPage reader={capabilities.lighting} editor={capabilities.lightingEditor} />
        : null;
    case "device-settings":
      return capabilities.deviceSettings
        ? <DeviceSettingsPage reader={capabilities.deviceSettings} editor={capabilities.deviceSettingsEditor} />
        : null;
    case "live-keys":
      return capabilities.analogKeys
        ? <LiveKeysPage source={capabilities.analogKeys} requestAccess={() => void connection.requestKeyboard()} />
        : null;
    case "device":
      return (
        <DevicePage
          identity={identity}
          onDisconnect={() => void connection.disconnect()}
          onForget={() => void connection.forget()}
        />
      );
    case "interface":
      return <InterfacePage theme={theme} />;
    case "about":
      return <AboutPage />;
  }
}
