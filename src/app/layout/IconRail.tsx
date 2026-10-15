import { LogoIcon } from "../components/icons";
import { RAIL_ICONS } from "./section-icons";
import type { Rail, RailId } from "./sections";

interface IconRailProps {
  readonly rails: readonly Rail[];
  readonly selected: RailId;
  readonly onSelect: (rail: Rail) => void;
}

export function IconRail({ rails, selected, onSelect }: IconRailProps) {
  return (
    <nav
      aria-label="Areas"
      className="flex shrink-0 items-center gap-2 bg-rail px-3 py-2 md:h-full md:w-20 md:flex-col md:px-2 md:py-5"
    >
      <span className="mr-2 flex md:mr-0 md:mb-5">
        <LogoIcon size={40} />
      </span>
      {rails.map((rail) => {
        const RailIcon = RAIL_ICONS[rail.id];
        const isSelected = rail.id === selected;
        return (
          <button
            key={rail.id}
            type="button"
            aria-current={isSelected ? "page" : undefined}
            onClick={() => onSelect(rail)}
            className={[
              "flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-semibold transition",
              "focus-visible:outline-2 focus-visible:outline-accent",
              isSelected ? "bg-tint text-fg" : "text-muted hover:text-strong",
            ].join(" ")}
          >
            <RailIcon width={18} height={18} className={isSelected ? "text-accent-ink" : undefined} />
            {rail.label}
          </button>
        );
      })}
    </nav>
  );
}
