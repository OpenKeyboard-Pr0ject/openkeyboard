import { Button } from "../components/Button";

interface KeySelectionBarProps {
  readonly title: string;
  readonly selectedCount: number;
  readonly hint: string;
  readonly onSelectAll: () => void;
  readonly onClear: () => void;
}

export function KeySelectionBar({ title, selectedCount, hint, onSelectAll, onClear }: KeySelectionBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <p
        className={[
          "m-0 text-center text-sm font-bold tracking-wide uppercase",
          selectedCount > 0 ? "text-accent-ink" : "text-muted",
        ].join(" ")}
      >
        {selectedCount > 0 ? `${selectedCount} ${selectedCount === 1 ? "key" : "keys"} selected` : hint}
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-2xl font-bold text-strong">{title}</h1>
        <div className="flex gap-2">
          <Button size="small" onClick={onSelectAll}>Select all keys</Button>
          <Button size="small" disabled={selectedCount === 0} onClick={onClear}>Discard selection</Button>
        </div>
      </div>
    </div>
  );
}
