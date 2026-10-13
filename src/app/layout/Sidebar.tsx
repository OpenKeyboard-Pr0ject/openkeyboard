import type { ComponentType, SVGProps } from "react";
import type { KeyboardIdentity } from "../../drivers/keyboard-driver";
import { ActivityIcon, BatteryIcon, DeviceIcon, KeymapIcon, LightingIcon, ProfilesIcon } from "../components/icons";
import { Badge, StatusDot } from "../components/feedback";
import { ThemeSwitcher } from "../theme/ThemeSwitcher";
import type { ThemeControl } from "../theme/use-theme";
import { Brand } from "./Brand";
import { SECTION_GROUPS, type Section, type SectionId } from "./sections";

const SIDEBAR_CLASSES = [
  "flex w-full shrink-0 flex-col gap-5 border-b border-line bg-sidebar p-4",
  "md:h-full md:w-64 md:border-r md:border-b-0",
].join(" ");

const NAV_CLASSES = "flex gap-4 overflow-x-auto md:flex-1 md:flex-col md:overflow-visible";
const GROUP_LABEL_CLASSES = "mb-1 hidden px-2 text-xs font-semibold tracking-wide text-muted uppercase md:block";

const SECTION_ICONS: Readonly<Record<SectionId, ComponentType<SVGProps<SVGSVGElement>>>> = {
  profiles: ProfilesIcon,
  keymap: KeymapIcon,
  lighting: LightingIcon,
  "device-settings": BatteryIcon,
  "live-keys": ActivityIcon,
  device: DeviceIcon,
};

interface SidebarProps {
  readonly identity: KeyboardIdentity;
  readonly sections: readonly Section[];
  readonly selected: SectionId;
  readonly onSelect: (section: SectionId) => void;
  readonly theme: ThemeControl;
}

export function Sidebar({ identity, sections, selected, onSelect, theme }: SidebarProps) {
  return (
    <aside className={SIDEBAR_CLASSES}>
      <Brand />
      <DeviceCard identity={identity} />
      <nav aria-label="Keyboard settings" className={NAV_CLASSES}>
        {SECTION_GROUPS.map((group) => {
          const groupSections = sections.filter((section) => section.group === group);
          if (groupSections.length === 0) return null;
          return (
            <div key={group} className="flex shrink-0 gap-1 md:flex-col">
              <p className={GROUP_LABEL_CLASSES}>{group}</p>
              {groupSections.map((section) => (
                <NavItem
                  key={section.id}
                  section={section}
                  isSelected={section.id === selected}
                  onSelect={() => onSelect(section.id)}
                />
              ))}
            </div>
          );
        })}
      </nav>
      <ThemeSwitcher control={theme} />
    </aside>
  );
}

function DeviceCard({ identity }: { readonly identity: KeyboardIdentity }) {
  return (
    <div className="rounded-xl border border-line bg-raised p-3">
      <div className="flex items-center gap-2">
        <StatusDot tone="positive" />
        <p className="m-0 truncate text-sm font-semibold text-fg" title={identity.productName}>
          {identity.productName}
        </p>
      </div>
      <p className="mt-1 mb-2 text-xs text-muted">
        {identity.vendorName} · Firmware {identity.firmwareVersion}
      </p>
      <Badge tone={identity.hardwareVerified ? "positive" : "warning"}>
        {identity.hardwareVerified ? "Verified on hardware" : "Not yet verified on hardware"}
      </Badge>
    </div>
  );
}

interface NavItemProps {
  readonly section: Section;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

function NavItem({ section, isSelected, onSelect }: NavItemProps) {
  const SectionIcon = SECTION_ICONS[section.id];
  return (
    <button
      type="button"
      aria-current={isSelected ? "page" : undefined}
      onClick={onSelect}
      className={[
        "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm whitespace-nowrap transition",
        "focus-visible:outline-2 focus-visible:outline-accent",
        isSelected ? "bg-accent-soft font-semibold text-fg" : "text-muted hover:bg-raised hover:text-fg",
      ].join(" ")}
    >
      <SectionIcon className={isSelected ? "text-accent" : undefined} />
      {section.label}
    </button>
  );
}
