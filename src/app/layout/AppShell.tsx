import { useState } from "react";
import type { ConnectionState, KeyboardConnection } from "../../connection/keyboard-connection";
import { DeviceSettingsPage } from "../pages/device-settings/DeviceSettingsPage";
import { DevicePage } from "../pages/DevicePage";
import { KeymapPage } from "../pages/keymap/KeymapPage";
import { LightingPage } from "../pages/lighting/LightingPage";
import { LiveKeysPage } from "../pages/live-keys/LiveKeysPage";
import { ProfilesPage } from "../pages/profiles/ProfilesPage";
import type { ThemeControl } from "../theme/use-theme";
import { type SectionId, sectionsFor } from "./sections";
import { Sidebar } from "./Sidebar";

type ConnectedState = Extract<ConnectionState, { kind: "connected" }>;

interface AppShellProps {
  readonly state: ConnectedState;
  readonly connection: KeyboardConnection;
  readonly theme: ThemeControl;
}

export function AppShell({ state, connection, theme }: AppShellProps) {
  const sections = sectionsFor(state.capabilities);
  const [selected, setSelected] = useState<SectionId>(sections[0].id);
  const current = sections.some((section) => section.id === selected) ? selected : sections[0].id;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar identity={state.identity} sections={sections} selected={current} onSelect={setSelected} theme={theme} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
          <SectionPage section={current} state={state} connection={connection} />
        </div>
      </main>
    </div>
  );
}

interface SectionPageProps {
  readonly section: SectionId;
  readonly state: ConnectedState;
  readonly connection: KeyboardConnection;
}

function SectionPage({ section, state, connection }: SectionPageProps) {
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
  }
}
