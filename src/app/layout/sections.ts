import type { KeyboardCapabilities } from "../../drivers/keyboard-driver";

export type SectionId =
  | "profiles"
  | "actuation"
  | "rapid-trigger"
  | "keymap"
  | "lighting"
  | "device-settings"
  | "live-keys"
  | "device"
  | "interface"
  | "about";
export type SectionGroup =
  | "Profiles"
  | "Keyboard Configuration"
  | "Monitoring"
  | "Keyboard"
  | "Interface"
  | "OpenKeyboard";
export type RailId = "keyboard" | "settings" | "help";

export interface Section {
  readonly id: SectionId;
  readonly label: string;
  readonly group: SectionGroup;
}

export interface Rail {
  readonly id: RailId;
  readonly label: string;
  readonly title: string;
  readonly groups: readonly SectionGroup[];
}

export const RAILS: readonly Rail[] = [
  {
    id: "keyboard",
    label: "Keyboard",
    title: "Keyboard Configuration",
    groups: ["Profiles", "Keyboard Configuration", "Monitoring"],
  },
  { id: "settings", label: "Settings", title: "Settings", groups: ["Keyboard", "Interface"] },
  { id: "help", label: "Help", title: "Help", groups: ["OpenKeyboard"] },
];

const CAPABILITY_SECTIONS: ReadonlyArray<readonly [Section, (capabilities: KeyboardCapabilities) => boolean]> = [
  [{ id: "profiles", label: "My Profiles", group: "Profiles" }, (capabilities) => Boolean(capabilities.profiles)],
  [
    { id: "actuation", label: "Actuation Point", group: "Keyboard Configuration" },
    (capabilities) => Boolean(capabilities.profiles),
  ],
  [
    { id: "rapid-trigger", label: "Rapid Trigger", group: "Keyboard Configuration" },
    (capabilities) => Boolean(capabilities.profiles),
  ],
  [
    { id: "lighting", label: "RGB Settings", group: "Keyboard Configuration" },
    (capabilities) => Boolean(capabilities.lighting),
  ],
  [{ id: "keymap", label: "Keymap", group: "Keyboard Configuration" }, (capabilities) => Boolean(capabilities.keymap)],
  [
    { id: "device-settings", label: "Battery and performance", group: "Keyboard Configuration" },
    (capabilities) => Boolean(capabilities.deviceSettings),
  ],
  [
    { id: "live-keys", label: "Live key input", group: "Monitoring" },
    (capabilities) => Boolean(capabilities.analogKeys),
  ],
];

const DEVICE_SECTION: Section = { id: "device", label: "Device", group: "Keyboard" };

const APPLICATION_SECTIONS: readonly Section[] = [
  { id: "interface", label: "Interface", group: "Interface" },
  { id: "about", label: "About OpenKeyboard", group: "OpenKeyboard" },
];

export function sectionsFor(capabilities: KeyboardCapabilities): Section[] {
  return [
    ...CAPABILITY_SECTIONS.filter(([, isOffered]) => isOffered(capabilities)).map(([section]) => section),
    DEVICE_SECTION,
  ];
}

export function navigationFor(capabilities: KeyboardCapabilities): Section[] {
  return [...sectionsFor(capabilities), ...APPLICATION_SECTIONS];
}

export function railOf(section: Section): Rail {
  return RAILS.find((rail) => rail.groups.includes(section.group)) ?? RAILS[0];
}

export function sectionsOfRail(sections: readonly Section[], rail: Rail): Section[] {
  return sections.filter((section) => rail.groups.includes(section.group));
}

export function railsWithSections(sections: readonly Section[]): Rail[] {
  return RAILS.filter((rail) => sectionsOfRail(sections, rail).length > 0);
}
