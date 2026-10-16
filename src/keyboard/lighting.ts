import type { LayeredEffectCatalog, LayeredEffects } from "./lighting-effects";
import type { MatrixPosition } from "./physical-layout";

export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export type WaveDirection = "left-to-right" | "right-to-left";

export type EffectDuration = "short" | "medium" | "long";

export type LightingEffect =
  | { readonly kind: "off" }
  | { readonly kind: "static"; readonly color: RgbColor }
  | { readonly kind: "spectrum" }
  | { readonly kind: "breathing"; readonly colors: readonly RgbColor[] }
  | { readonly kind: "wave"; readonly direction: WaveDirection }
  | { readonly kind: "reactive"; readonly color: RgbColor; readonly duration: EffectDuration }
  | { readonly kind: "starlight"; readonly colors: readonly RgbColor[]; readonly duration: EffectDuration }
  | { readonly kind: "per-key" }
  | { readonly kind: "layered"; readonly description: string }
  | { readonly kind: "unrecognized"; readonly description: string };

export type LightingEffectKind = LightingEffect["kind"];

export type WritableLightingEffect = Exclude<
  LightingEffect,
  { kind: "unrecognized" } | { kind: "per-key" } | { kind: "layered" }
>;

export type WritableLightingEffectKind = WritableLightingEffect["kind"];

export interface KeyColor extends MatrixPosition {
  readonly color: RgbColor;
}

export interface LightingState {
  readonly brightnessPercent: number;
  readonly effect: LightingEffect;
  readonly keyColors?: readonly KeyColor[];
  readonly effectHidesKeyColors?: boolean;
  readonly layeredEffects?: LayeredEffects;
  readonly profileName?: string;
  readonly profileSlot?: number;
  readonly effectsDisabledBy?: LightingEffectsBlocker;
}

export type LightingEffectsBlocker = "tachyon-mode";

export interface LightingChange {
  readonly brightnessPercent?: number;
  readonly effect?: WritableLightingEffect;
  readonly keyColors?: readonly KeyColor[];
  readonly layeredEffects?: LayeredEffects;
}

export interface KeyboardLightingReader {
  readLighting(): Promise<LightingState>;
}

export interface LightingFrameReader {
  readFrame(): Promise<readonly KeyColor[]>;
}

export interface LightingPreview {
  show(change: LightingChange): Promise<void>;
  save(change: LightingChange): Promise<LightingState>;
  discard(): Promise<void>;
}

export interface KeyboardLightingEditor {
  readonly supportedEffects: readonly WritableLightingEffectKind[];
  readonly maximumEffectColors: number;
  readonly supportsKeyColors: boolean;
  readonly layeredEffectCatalog?: LayeredEffectCatalog;
  updateLighting(change: LightingChange): Promise<LightingState>;
  beginPreview?(): Promise<LightingPreview>;
}

export const BRIGHTNESS_PERCENT_RANGE = { min: 0, max: 100, step: 1 } as const;

const HEX_DIGITS_PER_CHANNEL = 2;
const HEX_COLOR_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const MAXIMUM_CHANNEL_VALUE = 0xff;

export class InvalidColorError extends Error {
  constructor(text: string) {
    super(`"${text}" is not a color in the form #rrggbb.`);
    this.name = "InvalidColorError";
  }
}

export class BrightnessOutOfRangeError extends Error {
  constructor(percent: number) {
    super(
      `Brightness must be a whole number from ${BRIGHTNESS_PERCENT_RANGE.min} `
      + `to ${BRIGHTNESS_PERCENT_RANGE.max} %, not ${percent} %.`,
    );
    this.name = "BrightnessOutOfRangeError";
  }
}

export class UnsupportedLightingEffectError extends Error {
  constructor(effect: WritableLightingEffect, reason: string) {
    super(`The ${effect.kind} effect cannot be written: ${reason}`);
    this.name = "UnsupportedLightingEffectError";
  }
}

export class KeyColorsNotSupportedError extends Error {
  constructor() {
    super("This keyboard cannot set a color per key.");
    this.name = "KeyColorsNotSupportedError";
  }
}

export class InvalidKeyColorError extends Error {
  constructor(keyColor: KeyColor) {
    super(
      `The color for row ${keyColor.matrixRow}, column ${keyColor.matrixColumn} must have whole channels `
      + `from 0 to 255.`,
    );
    this.name = "InvalidKeyColorError";
  }
}

export function assertValidKeyColors(keyColors: readonly KeyColor[]): void {
  const invalid = keyColors.find((keyColor) => !isValidColor(keyColor.color));
  if (invalid) throw new InvalidKeyColorError(invalid);
}

export function assertValidBrightness(percent: number): void {
  const valid = Number.isInteger(percent)
    && percent >= BRIGHTNESS_PERCENT_RANGE.min
    && percent <= BRIGHTNESS_PERCENT_RANGE.max;
  if (!valid) throw new BrightnessOutOfRangeError(percent);
}

export function effectColors(effect: LightingEffect): readonly RgbColor[] {
  if ("color" in effect) return [effect.color];
  if ("colors" in effect) return effect.colors;
  return [];
}

export function isValidColor(color: RgbColor): boolean {
  return [color.red, color.green, color.blue]
    .every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= MAXIMUM_CHANNEL_VALUE);
}

export function colorToHex(color: RgbColor): string {
  const channels = [color.red, color.green, color.blue];
  return `#${channels.map((channel) => channel.toString(16).padStart(HEX_DIGITS_PER_CHANNEL, "0")).join("")}`;
}

export function colorFromHex(text: string): RgbColor {
  const match = HEX_COLOR_PATTERN.exec(text);
  if (!match) throw new InvalidColorError(text);
  const [red, green, blue] = match.slice(1).map((channel) => parseInt(channel, 16));
  return { red, green, blue };
}

export function sameLightingEffect(first: LightingEffect, second: LightingEffect): boolean {
  return effectSignature(first) === effectSignature(second);
}

function effectSignature(effect: LightingEffect): string {
  return [
    effect.kind,
    ...effectColors(effect).map(colorToHex),
    "direction" in effect ? effect.direction : "",
    "duration" in effect ? effect.duration : "",
    "description" in effect ? effect.description : "",
  ].join("|");
}
