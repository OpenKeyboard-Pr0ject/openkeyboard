import type { KeyboardCapabilities } from "../../drivers/keyboard-driver";

export type SectionId = "profiles" | "keymap" | "lighting" | "device-settings" | "live-keys" | "device";
export type SectionGroup = "Configuration" | "Monitoring" | "Keyboard";

export interface Section {
  readonly id: SectionId;
  readonly label: string;
  readonly group: SectionGroup;
}

export const SECTION_GROUPS: readonly SectionGroup[] = ["Configuration", "Monitoring", "Keyboard"];

const CAPABILITY_SECTIONS: ReadonlyArray<readonly [Section, (capabilities: KeyboardCapabilities) => boolean]> = [
  [{ id: "profiles", label: "Profiles", group: "Configuration" }, (capabilities) => Boolean(capabilities.profiles)],
  [{ id: "keymap", label: "Keymap", group: "Configuration" }, (capabilities) => Boolean(capabilities.keymap)],
  [{ id: "lighting", label: "Lighting", group: "Configuration" }, (capabilities) => Boolean(capabilities.lighting)],
  [
    { id: "device-settings", label: "Battery and performance", group: "Configuration" },
    (capabilities) => Boolean(capabilities.deviceSettings),
  ],
  [
    { id: "live-keys", label: "Live key input", group: "Monitoring" },
    (capabilities) => Boolean(capabilities.analogKeys),
  ],
];

const DEVICE_SECTION: Section = { id: "device", label: "Device", group: "Keyboard" };

export function sectionsFor(capabilities: KeyboardCapabilities): Section[] {
  return [
    ...CAPABILITY_SECTIONS.filter(([, isOffered]) => isOffered(capabilities)).map(([section]) => section),
    DEVICE_SECTION,
  ];
}
