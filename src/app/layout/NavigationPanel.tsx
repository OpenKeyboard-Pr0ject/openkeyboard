import type { KeyboardIdentity } from "../../drivers/keyboard-driver";
import { StatusDot } from "../components/feedback";
import { KeyboardIcon } from "../components/icons";
import { SECTION_ICONS } from "./section-icons";
import type { Rail, Section, SectionId } from "./sections";

interface NavigationPanelProps {
  readonly rail: Rail;
  readonly sections: readonly Section[];
  readonly selected: SectionId;
  readonly onSelect: (section: SectionId) => void;
  readonly identity: KeyboardIdentity;
}

export function NavigationPanel({ rail, sections, selected, onSelect, identity }: NavigationPanelProps) {
  return (
    <aside className="my-4 ml-4 hidden w-[264px] shrink-0 flex-col rounded-lg bg-panel p-4 md:flex">
      <h2 className="m-0 mb-4 text-base font-bold text-strong">{rail.title}</h2>
      <DeviceCard identity={identity} />
      <nav aria-label={rail.title} className="mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {rail.groups.map((group) => {
          const groupSections = sections.filter((section) => section.group === group);
          if (groupSections.length === 0) return null;
          return (
            <div key={group} className="flex flex-col gap-1">
              <p className="m-0 mb-1 px-4 text-xs font-semibold text-muted">{group}</p>
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
      <p className="m-0 mt-4 text-center text-sm text-faint">OpenKeyboard · open source</p>
    </aside>
  );
}

export function DeviceThumbnail() {
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-sunken text-fg">
      <KeyboardIcon width={24} height={24} />
      <span className="absolute top-1 left-1 flex">
        <StatusDot tone="positive" />
      </span>
    </span>
  );
}

function DeviceCard({ identity }: { readonly identity: KeyboardIdentity }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-subtle p-2">
      <DeviceThumbnail />
      <div className="min-w-0">
        <p className="m-0 text-xs font-semibold text-muted">My keyboard</p>
        <p className="m-0 truncate text-base font-bold text-strong" title={identity.productName}>
          {identity.productName}
        </p>
      </div>
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
        "flex h-10 shrink-0 items-center gap-3 rounded-lg px-4 text-left text-base whitespace-nowrap transition",
        "focus-visible:outline-2 focus-visible:outline-accent",
        isSelected ? "bg-tint font-bold text-fg" : "text-fg hover:bg-subtle hover:text-strong",
      ].join(" ")}
    >
      <SectionIcon width={16} height={16} className={isSelected ? "text-accent-ink" : "text-muted"} />
      <span className="truncate">{section.label}</span>
    </button>
  );
}
