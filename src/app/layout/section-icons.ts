import type { ComponentType, SVGProps } from "react";
import {
  ActivityIcon,
  ActuationIcon,
  BatteryIcon,
  BookIcon,
  DeviceIcon,
  HelpIcon,
  InterfaceIcon,
  KeyboardIcon,
  KeymapIcon,
  LightingIcon,
  ProfilesIcon,
  RapidTriggerIcon,
  SettingsIcon,
} from "../components/icons";
import type { RailId, SectionId } from "./sections";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const SECTION_ICONS: Readonly<Record<SectionId, IconComponent>> = {
  profiles: ProfilesIcon,
  actuation: ActuationIcon,
  "rapid-trigger": RapidTriggerIcon,
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
