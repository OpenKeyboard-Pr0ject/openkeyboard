import type { CSSProperties } from "react";
import { type LayoutKey, layoutSize, matrixKeyId, type PhysicalLayout } from "../../keyboard/physical-layout";

const KEY_GAP_CQW = 0.3;
const RELATIVE_LUMINANCE_THRESHOLD = 0.55;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const LUMINANCE_WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
const MAXIMUM_CHANNEL_VALUE = 255;

export interface KeyAppearance {
  readonly annotation?: string;
  readonly fill?: string;
  readonly isHighlighted?: boolean;
}

interface KeyboardCanvasProps {
  readonly layout: PhysicalLayout;
  readonly label: string;
  readonly selectedIds?: ReadonlySet<string>;
  readonly onToggleKey?: (id: string) => void;
  readonly appearanceOf?: (key: LayoutKey) => KeyAppearance;
  readonly isAnimated?: boolean;
  readonly onHoldKey?: (id: string, isHeld: boolean) => void;
}

export function KeyboardCanvas(
  { layout, label, selectedIds, onToggleKey, appearanceOf, isAnimated = false, onHoldKey }: KeyboardCanvasProps,
) {
  const size = layoutSize(layout);
  return (
    <div className="rounded-xl bg-case p-[1.6%] shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
      <div
        role={onToggleKey ? "group" : "img"}
        aria-label={label}
        className="@container relative w-full"
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
      >
        {layout.keys.map((key) => {
          const id = matrixKeyId(key);
          return (
            <KeyCap
              key={id}
              layoutKey={key}
              position={keyPosition(key, size.width, size.height)}
              appearance={appearanceOf?.(key) ?? {}}
              isSelected={selectedIds?.has(id) ?? false}
              isAnimated={isAnimated}
              onToggle={onToggleKey ? () => onToggleKey(id) : undefined}
              onHold={onHoldKey ? (isHeld) => onHoldKey(id, isHeld) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

interface KeyCapProps {
  readonly layoutKey: LayoutKey;
  readonly position: CSSProperties;
  readonly appearance: KeyAppearance;
  readonly isSelected: boolean;
  readonly isAnimated: boolean;
  readonly onToggle?: () => void;
  readonly onHold?: (isHeld: boolean) => void;
}

function KeyCap({ layoutKey, position, appearance, isSelected, isAnimated, onToggle, onHold }: KeyCapProps) {
  const faceClasses = [
    "relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[0.5cqw]",
    "text-[clamp(6px,1.1cqw,13px)] leading-tight font-semibold",
    isAnimated ? "transition-[filter]" : "transition",
    "shadow-[inset_0_-0.3cqw_0_rgba(0,0,0,0.35)]",
    appearance.fill ? "" : appearance.isHighlighted ? "bg-keycap-highlight" : "bg-keycap",
    isSelected ? "outline-2 outline-accent" : "",
    onToggle ? "cursor-pointer hover:brightness-125" : "",
  ].join(" ");
  const faceStyle: CSSProperties = appearance.fill
    ? { background: appearance.fill, color: legendColorOn(appearance.fill) }
    : { color: "var(--app-keycap-legend)" };
  const holdHandlers = onHold
    ? {
      onPointerDown: () => onHold(true),
      onPointerUp: () => onHold(false),
      onPointerLeave: () => onHold(false),
      onPointerCancel: () => onHold(false),
    }
    : {};
  const face = (
    <>
      {appearance.annotation && (
        <span className="absolute top-[0.3cqw] left-[0.45cqw] text-[clamp(5px,0.85cqw,11px)] font-bold opacity-80">
          {appearance.annotation}
        </span>
      )}
      <span className="px-[0.3cqw] text-center">{layoutKey.label}</span>
    </>
  );
  return (
    <span className="absolute" style={{ ...position, padding: `${KEY_GAP_CQW}cqw` }}>
      {onToggle ? (
        <button
          type="button"
          aria-pressed={isSelected}
          aria-label={appearance.annotation ? `${layoutKey.label}, ${appearance.annotation}` : layoutKey.label}
          onClick={onToggle}
          className={`${faceClasses} focus-visible:outline-2 focus-visible:outline-accent`}
          style={faceStyle}
          {...holdHandlers}
        >
          {face}
        </button>
      ) : (
        <span className={faceClasses} style={faceStyle} {...holdHandlers}>{face}</span>
      )}
    </span>
  );
}

function keyPosition(key: LayoutKey, boardWidth: number, boardHeight: number): CSSProperties {
  return {
    left: `${(key.x / boardWidth) * 100}%`,
    top: `${(key.y / boardHeight) * 100}%`,
    width: `${(key.width / boardWidth) * 100}%`,
    height: `${(key.height / boardHeight) * 100}%`,
  };
}

export function legendColorOn(fill: string): string {
  const match = HEX_COLOR_PATTERN.exec(fill);
  if (!match) return "#ffffff";
  const luminance = match.slice(1)
    .map((channel) => parseInt(channel, 16) / MAXIMUM_CHANNEL_VALUE)
    .reduce((total, channel, index) => total + channel * LUMINANCE_WEIGHTS[index], 0);
  return luminance > RELATIVE_LUMINANCE_THRESHOLD ? "#181a1b" : "#ffffff";
}
