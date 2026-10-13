import type {
  EffectDuration,
  LightingEffect,
  RgbColor,
  WaveDirection,
  WritableLightingEffect,
} from "../../keyboard/lighting";
import { formatHex } from "../../shared/hex";
import { RazerProtocolError } from "./razer-codec";
import { RAZER_BACKLIGHT_LED, RAZER_VARIABLE_STORAGE } from "./razer-constants";

const MAXIMUM_BRIGHTNESS = 0xff;
const PERCENT = 100;

const EffectId = {
  off: 0x00,
  static: 0x01,
  breathing: 0x02,
  spectrum: 0x03,
  wave: 0x04,
  reactive: 0x05,
  starlight: 0x07,
} as const;

const EffectArgument = { effectId: 2, mode: 3, speed: 4, colorCount: 5, firstColor: 6 } as const;
const BRIGHTNESS_ARGUMENT = 2;
const BYTES_PER_COLOR = 3;
const EFFECT_HEADER_BYTES = EffectArgument.firstColor;
export const MAXIMUM_EFFECT_COLORS = 2;

const WAVE_SPEED = 0x28;
const WaveDirectionCode: Readonly<Record<WaveDirection, number>> = { "left-to-right": 0x01, "right-to-left": 0x02 };
const DurationCode: Readonly<Record<EffectDuration, number>> = { short: 0x01, medium: 0x02, long: 0x03 };

export function backlightAddress(): number[] {
  return [RAZER_VARIABLE_STORAGE, RAZER_BACKLIGHT_LED];
}

export function percentToBrightness(percent: number): number {
  return Math.round((percent / PERCENT) * MAXIMUM_BRIGHTNESS);
}

export function brightnessToPercent(brightness: number): number {
  return Math.round((brightness / MAXIMUM_BRIGHTNESS) * PERCENT);
}

export function encodeBrightnessArguments(percent: number): number[] {
  return [...backlightAddress(), percentToBrightness(percent)];
}

export function decodeBrightnessPercent(replyArguments: Uint8Array): number {
  if (replyArguments.length <= BRIGHTNESS_ARGUMENT) {
    throw new RazerProtocolError("The brightness reply is too short.");
  }
  return brightnessToPercent(replyArguments[BRIGHTNESS_ARGUMENT]);
}

export function encodeEffectArguments(effect: WritableLightingEffect): number[] {
  switch (effect.kind) {
    case "off":
      return effectHeader(EffectId.off);
    case "spectrum":
      return effectHeader(EffectId.spectrum);
    case "static":
      return effectWithColors(effectHeader(EffectId.static), [effect.color]);
    case "breathing":
      return effectWithColors(effectHeader(EffectId.breathing, effect.colors.length), effect.colors);
    case "wave":
      return effectHeader(EffectId.wave, WaveDirectionCode[effect.direction], WAVE_SPEED);
    case "reactive":
      return effectWithColors(effectHeader(EffectId.reactive, 0, DurationCode[effect.duration]), [effect.color]);
    case "starlight":
      return effectWithColors(effectHeader(EffectId.starlight, 0, DurationCode[effect.duration]), effect.colors);
  }
}

export function decodeEffect(replyArguments: Uint8Array): LightingEffect {
  if (replyArguments.length <= EffectArgument.effectId) {
    throw new RazerProtocolError("The lighting effect reply is too short.");
  }
  return decodeKnownEffect(replyArguments) ?? unrecognizedEffect(replyArguments);
}

function decodeKnownEffect(replyArguments: Uint8Array): LightingEffect | undefined {
  const colors = colorsOf(replyArguments);
  const duration = durationOf(replyArguments[EffectArgument.speed]);
  switch (replyArguments[EffectArgument.effectId]) {
    case EffectId.off:
      return { kind: "off" };
    case EffectId.spectrum:
      return { kind: "spectrum" };
    case EffectId.static:
      return colors.length === 1 ? { kind: "static", color: colors[0] } : undefined;
    case EffectId.breathing:
      return { kind: "breathing", colors };
    case EffectId.wave:
      return waveOf(replyArguments[EffectArgument.mode]);
    case EffectId.reactive:
      return colors.length === 1 && duration ? { kind: "reactive", color: colors[0], duration } : undefined;
    case EffectId.starlight:
      return duration ? { kind: "starlight", colors, duration } : undefined;
    default:
      return undefined;
  }
}

function effectHeader(effectId: number, mode = 0, speed = 0): number[] {
  return [...backlightAddress(), effectId, mode, speed, 0];
}

function effectWithColors(header: readonly number[], colors: readonly RgbColor[]): number[] {
  if (colors.length > MAXIMUM_EFFECT_COLORS) {
    throw new RazerProtocolError(`An effect takes at most ${MAXIMUM_EFFECT_COLORS} colors.`);
  }
  const withCount = [...header];
  withCount[EffectArgument.colorCount] = colors.length;
  return [...withCount, ...colors.flatMap((color) => [color.red, color.green, color.blue])];
}

function colorsOf(replyArguments: Uint8Array): RgbColor[] {
  const count = Math.min(replyArguments[EffectArgument.colorCount] ?? 0, MAXIMUM_EFFECT_COLORS);
  return Array.from({ length: count }, (_, index) => EFFECT_HEADER_BYTES + index * BYTES_PER_COLOR)
    .filter((offset) => offset + BYTES_PER_COLOR <= replyArguments.length)
    .map((offset) => ({
      red: replyArguments[offset],
      green: replyArguments[offset + 1],
      blue: replyArguments[offset + 2],
    }));
}

function durationOf(code: number | undefined): EffectDuration | undefined {
  return (Object.keys(DurationCode) as EffectDuration[]).find((duration) => DurationCode[duration] === code);
}

function waveOf(code: number | undefined): LightingEffect | undefined {
  const direction = (Object.keys(WaveDirectionCode) as WaveDirection[])
    .find((candidate) => WaveDirectionCode[candidate] === code);
  return direction ? { kind: "wave", direction } : undefined;
}

function unrecognizedEffect(replyArguments: Uint8Array): LightingEffect {
  const effectId = replyArguments[EffectArgument.effectId];
  return { kind: "unrecognized", description: `Effect ${formatHex(effectId, 2)}` };
}
