import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { colorFromHex, colorToHex, type RgbColor } from "../../keyboard/lighting";
import { type HsvColor, hsvFromRgb, rgbFromHsv } from "./color-math";
import { EyedropperIcon } from "./icons";

type ColorMode = "rgb" | "hex";

interface EyeDropperResult {
  readonly sRGBHex: string;
}

type EyeDropperConstructor = new () => { open(): Promise<EyeDropperResult> };

const COLOR_MODE_OPTIONS: ReadonlyArray<{ readonly value: ColorMode; readonly label: string }> = [
  { value: "rgb", label: "RGB" },
  { value: "hex", label: "HEX" },
];
const CHANNEL_RANGE = { min: 0, max: 255 } as const;
const COMPACT_INPUT_CLASSES = [
  "h-10 w-full min-w-0 rounded-md border border-line bg-sunken px-2 text-base tabular-nums text-strong",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");
const HUE_MAXIMUM_DEGREES = 359;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const KEYBOARD_STEP = 0.02;
const PERCENT = 100;
const HUE_TRACK = "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)";
const CHANNELS = [
  { key: "red", label: "R", name: "Red" },
  { key: "green", label: "G", name: "Green" },
  { key: "blue", label: "B", name: "Blue" },
] as const;

interface ColorPickerProps {
  readonly color: string;
  readonly onChange: (color: string) => void;
  readonly recentColors: readonly string[];
  readonly disabled?: boolean;
}

export function ColorPicker({ color, onChange, recentColors, disabled }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HsvColor>(() => hsvFromRgb(colorFromHex(color)));
  const [mode, setMode] = useState<ColorMode>("rgb");
  const shownColor = colorToHex(rgbFromHsv(hsv)) === color ? hsv : hsvFromRgb(colorFromHex(color));
  const rgb = colorFromHex(color);
  const eyeDropper = eyeDropperConstructor();

  const choose = (next: HsvColor) => {
    setHsv(next);
    onChange(colorToHex(rgbFromHsv(next)));
  };

  const chooseRgb = (next: RgbColor) => {
    setHsv(hsvFromRgb(next));
    onChange(colorToHex(next));
  };

  const pickWithEyeDropper = async () => {
    if (!eyeDropper) return;
    try {
      const result = await new eyeDropper().open();
      chooseRgb(colorFromHex(result.sRGBHex));
    } catch {
      return;
    }
  };

  return (
    <div className="@container">
      <div className="grid gap-4 @md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <SaturationValueArea hsv={shownColor} disabled={disabled} onChange={choose} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Pick a color from the screen"
              title={eyeDropper ? "Pick a color from the screen" : "This browser cannot pick colors from the screen"}
              disabled={disabled || !eyeDropper}
              onClick={() => void pickWithEyeDropper()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-tint
                hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              <EyedropperIcon width={16} height={16} />
            </button>
            <input
              type="range"
              aria-label="Hue"
              min={0}
              max={HUE_MAXIMUM_DEGREES}
              value={Math.round(shownColor.hue)}
              disabled={disabled}
              onChange={(event) => choose({ ...shownColor, hue: event.target.valueAsNumber })}
              className="hue-slider h-3 min-w-0 flex-1 cursor-pointer appearance-none rounded-full"
              style={{ background: HUE_TRACK }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <ColorModeSwitch mode={mode} disabled={disabled} onChange={setMode} />
          {mode === "rgb"
            ? <RgbFields color={rgb} disabled={disabled} onChange={chooseRgb} />
            : <HexInput color={color} disabled={disabled} onChange={(hex) => chooseRgb(colorFromHex(hex))} />}
          <RecentColors colors={recentColors} current={color} disabled={disabled} onPick={chooseRgb} />
        </div>
      </div>
    </div>
  );
}

interface ColorModeSwitchProps {
  readonly mode: ColorMode;
  readonly disabled?: boolean;
  readonly onChange: (mode: ColorMode) => void;
}

function ColorModeSwitch({ mode, disabled, onChange }: ColorModeSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Color format" className="flex w-fit gap-1 rounded-md bg-sunken p-1">
      {COLOR_MODE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={[
            "h-7 rounded px-3 text-xs font-bold transition",
            mode === option.value ? "bg-accent text-on-accent" : "text-fg hover:bg-tint",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface RgbFieldsProps {
  readonly color: RgbColor;
  readonly disabled?: boolean;
  readonly onChange: (color: RgbColor) => void;
}

function RgbFields({ color, disabled, onChange }: RgbFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHANNELS.map((channel) => (
        <label key={channel.key} className="flex min-w-0 flex-col gap-1 text-xs font-bold text-muted">
          {channel.label}
          <input
            type="number"
            aria-label={`${channel.name} channel`}
            min={CHANNEL_RANGE.min}
            max={CHANNEL_RANGE.max}
            value={color[channel.key]}
            disabled={disabled}
            onChange={(event) => {
              const channelValue = event.target.valueAsNumber;
              const valid = Number.isInteger(channelValue)
                && channelValue >= CHANNEL_RANGE.min && channelValue <= CHANNEL_RANGE.max;
              if (valid) onChange({ ...color, [channel.key]: channelValue });
            }}
            className={COMPACT_INPUT_CLASSES}
          />
        </label>
      ))}
    </div>
  );
}

interface RecentColorsProps {
  readonly colors: readonly string[];
  readonly current: string;
  readonly disabled?: boolean;
  readonly onPick: (color: RgbColor) => void;
}

function RecentColors({ colors, current, disabled, onPick }: RecentColorsProps) {
  return (
    <div>
      <p className="mt-0 mb-2 text-sm font-bold tracking-wide text-fg uppercase">Recently used</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((recent) => (
          <button
            key={recent}
            type="button"
            title={recent}
            aria-label={`Use ${recent}`}
            disabled={disabled}
            onClick={() => onPick(colorFromHex(recent))}
            className={[
              "h-7 w-7 rounded-full border-2 transition hover:scale-110",
              recent === current ? "border-accent" : "border-line",
            ].join(" ")}
            style={{ background: recent }}
          />
        ))}
      </div>
    </div>
  );
}

interface SaturationValueAreaProps {
  readonly hsv: HsvColor;
  readonly disabled?: boolean;
  readonly onChange: (hsv: HsvColor) => void;
}

function SaturationValueArea({ hsv, disabled, onChange }: SaturationValueAreaProps) {
  const areaRef = useRef<HTMLDivElement>(null);

  const pickAt = (event: PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current;
    if (!area || disabled) return;
    const bounds = area.getBoundingClientRect();
    onChange({
      ...hsv,
      saturation: clampFraction((event.clientX - bounds.left) / bounds.width),
      value: 1 - clampFraction((event.clientY - bounds.top) / bounds.height),
    });
  };

  const moveWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Readonly<Record<string, Partial<HsvColor>>> = {
      ArrowLeft: { saturation: clampFraction(hsv.saturation - KEYBOARD_STEP) },
      ArrowRight: { saturation: clampFraction(hsv.saturation + KEYBOARD_STEP) },
      ArrowUp: { value: clampFraction(hsv.value + KEYBOARD_STEP) },
      ArrowDown: { value: clampFraction(hsv.value - KEYBOARD_STEP) },
    };
    const step = steps[event.key];
    if (!step || disabled) return;
    event.preventDefault();
    onChange({ ...hsv, ...step });
  };

  return (
    <div
      ref={areaRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.saturation * PERCENT)} %, `
        + `brightness ${Math.round(hsv.value * PERCENT)} %`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pickAt(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons > 0) pickAt(event);
      }}
      onKeyDown={moveWithKeys}
      className="relative aspect-[4/3] w-full cursor-crosshair touch-none rounded-md
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), `
          + `hsl(${hsv.hue} 100% 50%)`,
      }}
    >
      <span
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2
          border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
        style={{ left: `${hsv.saturation * PERCENT}%`, bottom: `${hsv.value * PERCENT}%` }}
      />
    </div>
  );
}

interface HexInputProps {
  readonly color: string;
  readonly disabled?: boolean;
  readonly onChange: (color: string) => void;
}

function HexInput({ color, disabled, onChange }: HexInputProps) {
  const [text, setText] = useState(color);
  const [lastColor, setLastColor] = useState(color);
  if (lastColor !== color) {
    setLastColor(color);
    setText(color);
  }
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted">
      HEX
      <input
        type="text"
        aria-label="Hex color"
        spellCheck={false}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          const typed = event.target.value.trim().toLowerCase();
          setText(typed);
          const withHash = typed.startsWith("#") ? typed : `#${typed}`;
          if (HEX_COLOR_PATTERN.test(withHash)) onChange(withHash);
        }}
        className={`${COMPACT_INPUT_CLASSES} font-mono`}
      />
    </label>
  );
}

function clampFraction(fraction: number): number {
  return Math.min(1, Math.max(0, fraction));
}

function eyeDropperConstructor(): EyeDropperConstructor | undefined {
  return (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}
