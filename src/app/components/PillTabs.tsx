import type { ReactNode } from "react";

export interface PillTab<Value extends string | number> {
  readonly value: Value;
  readonly label: ReactNode;
}

interface PillTabsProps<Value extends string | number> {
  readonly tabs: readonly PillTab<Value>[];
  readonly selected: Value | undefined;
  readonly onSelect: (value: Value) => void;
  readonly label: string;
}

export function PillTabs<Value extends string | number>({ tabs, selected, onSelect, label }: PillTabsProps<Value>) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isSelected = tab.value === selected;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(tab.value)}
            className={[
              "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-base transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              isSelected
                ? "border-accent bg-tint font-bold text-strong"
                : "border-transparent bg-subtle text-fg hover:bg-tint hover:text-strong",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
