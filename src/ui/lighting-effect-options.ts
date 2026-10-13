import {
  colorFromHex,
  colorToHex,
  type EffectDuration,
  effectColors,
  type LightingEffect,
  type RgbColor,
  type WaveDirection,
  type WritableLightingEffect,
  type WritableLightingEffectKind,
} from "../keyboard/lighting";
import { element, formField, select } from "./dom";
import { colorCountLabel, DURATION_LABELS, WAVE_DIRECTION_LABELS } from "./lighting-format";

export interface EffectOptions {
  readonly controls: readonly HTMLElement[];
  effect(): WritableLightingEffect;
}

const FALLBACK_COLORS: readonly RgbColor[] = [
  { red: 0xff, green: 0xff, blue: 0xff },
  { red: 0x00, green: 0x00, blue: 0xff },
];
const DEFAULT_DURATION: EffectDuration = "medium";
const DEFAULT_DIRECTION: WaveDirection = "left-to-right";

export function effectOptionsFor(
  kind: WritableLightingEffectKind,
  current: LightingEffect,
  maximumColors: number,
): EffectOptions {
  const startingColors = [...effectColors(current), ...FALLBACK_COLORS];
  const duration = "duration" in current ? current.duration : DEFAULT_DURATION;
  switch (kind) {
    case "off":
    case "spectrum":
      return { controls: [], effect: () => ({ kind }) };
    case "static":
      return staticOptions(startingColors[0]);
    case "reactive":
      return reactiveOptions(startingColors[0], duration);
    case "wave":
      return waveOptions("direction" in current ? current.direction : DEFAULT_DIRECTION);
    case "breathing":
      return multiColorOptions(startingColors, colorCountOf(current, kind), maximumColors, (colors) => ({
        kind,
        colors,
      }));
    case "starlight":
      return starlightOptions(startingColors, colorCountOf(current, kind), maximumColors, duration);
  }
}

function staticOptions(color: RgbColor): EffectOptions {
  const colorPicker = colorInput(color);
  return {
    controls: [formField("Color", colorPicker)],
    effect: () => ({ kind: "static", color: colorFromHex(colorPicker.value) }),
  };
}

function reactiveOptions(color: RgbColor, duration: EffectDuration): EffectOptions {
  const colorPicker = colorInput(color);
  const durationPicker = durationSelect(duration);
  return {
    controls: [formField("Color", colorPicker), formField("Fade", durationPicker)],
    effect: () => ({
      kind: "reactive",
      color: colorFromHex(colorPicker.value),
      duration: durationPicker.value as EffectDuration,
    }),
  };
}

function waveOptions(direction: WaveDirection): EffectOptions {
  const directions = Object.entries(WAVE_DIRECTION_LABELS) as Array<[WaveDirection, string]>;
  const directionPicker = select(directions, direction);
  return {
    controls: [formField("Direction", directionPicker)],
    effect: () => ({ kind: "wave", direction: directionPicker.value as WaveDirection }),
  };
}

function starlightOptions(
  startingColors: readonly RgbColor[],
  colorCount: number,
  maximumColors: number,
  duration: EffectDuration,
): EffectOptions {
  const durationPicker = durationSelect(duration);
  const colorOptions = multiColorOptions(startingColors, colorCount, maximumColors, (colors) => ({
    kind: "starlight",
    colors,
    duration: durationPicker.value as EffectDuration,
  }));
  return { controls: [...colorOptions.controls, formField("Twinkle", durationPicker)], effect: colorOptions.effect };
}

function multiColorOptions(
  startingColors: readonly RgbColor[],
  colorCount: number,
  maximumColors: number,
  effectWith: (colors: RgbColor[]) => WritableLightingEffect,
): EffectOptions {
  const counts = Array.from({ length: maximumColors + 1 }, (_, count) => colorCountOption(count));
  const countPicker = select(counts, String(Math.min(colorCount, maximumColors)));
  const colorPickers = startingColors.slice(0, maximumColors).map(colorInput);
  const colorFields = colorPickers.map((picker, index) => formField(`Color ${index + 1}`, picker));
  const showSelectedColors = (): void => {
    colorFields.forEach((colorField, index) => (colorField.hidden = index >= Number(countPicker.value)));
  };
  countPicker.addEventListener("change", showSelectedColors);
  showSelectedColors();
  return {
    controls: [formField("Colors", countPicker), ...colorFields],
    effect: () => effectWith(selectedColors(colorPickers, Number(countPicker.value))),
  };
}

function colorCountOption(count: number): readonly [string, string] {
  return [String(count), capitalize(colorCountLabel(count))];
}

function selectedColors(colorPickers: readonly HTMLInputElement[], count: number): RgbColor[] {
  return colorPickers.slice(0, count).map((picker) => colorFromHex(picker.value));
}

function colorCountOf(current: LightingEffect, kind: WritableLightingEffectKind): number {
  return current.kind === kind && "colors" in current ? current.colors.length : 1;
}

function durationSelect(duration: EffectDuration): HTMLSelectElement {
  return select(Object.entries(DURATION_LABELS) as Array<[EffectDuration, string]>, duration);
}

function colorInput(color: RgbColor): HTMLInputElement {
  const input = element("input", "settings-form__color");
  input.type = "color";
  input.value = colorToHex(color);
  return input;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
