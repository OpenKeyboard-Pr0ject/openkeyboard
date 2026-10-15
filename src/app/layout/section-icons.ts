import type { ComponentType, SVGProps } from "react";
import {
  ActivityIcon,
  BatteryIcon,
  BookIcon,
  DeviceIcon,
  HelpIcon,
  InterfaceIcon,
  KeyboardIcon,
  KeymapIcon,
  LightingIcon,
  ProfilesIcon,
  SettingsIcon,
} from "../components/icons";
import type { RailId, SectionId } from "./sections";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const SECTION_ICONS: Readonly<Record<SectionId, IconComponent>> = {
  profiles: ProfilesIcon,
  keymap: KeymapIcon,
  lighting: LightingIcon,
  "device-settings": BatteryIcon,
  "live-keys": ActivityIcon,
  device: DeviceIcon,
  interface: InterfaceIcon,
  about: BookIcon,
};

export const RAIL_ICONS: Readonly<Record<RailId, IconComponent>> = {
  keyboard: KeyboardIcon,
  settings: SettingsIcon,
  help: HelpIcon,
};
