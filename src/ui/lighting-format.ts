import type { EffectDuration, LightingEffect, LightingEffectKind, WaveDirection } from "../keyboard/lighting";

export const EFFECT_LABELS: Readonly<Record<LightingEffectKind, string>> = {
  static: "Static",
  spectrum: "Spectrum cycling",
  breathing: "Breathing",
  wave: "Wave",
  reactive: "Reactive",
  starlight: "Starlight",
  off: "Off",
  unrecognized: "Unrecognized",
};

export const DURATION_LABELS: Readonly<Record<EffectDuration, string>> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export const WAVE_DIRECTION_LABELS: Readonly<Record<WaveDirection, string>> = {
  "left-to-right": "Left to right",
  "right-to-left": "Right to left",
};

export function describeEffect(effect: LightingEffect): string {
  switch (effect.kind) {
    case "wave":
      return `${EFFECT_LABELS.wave}, ${WAVE_DIRECTION_LABELS[effect.direction].toLowerCase()}`;
    case "reactive":
      return `${EFFECT_LABELS.reactive}, ${DURATION_LABELS[effect.duration].toLowerCase()} fade`;
    case "starlight":
      return `${EFFECT_LABELS.starlight}, ${colorCountLabel(effect.colors.length)}, `
        + `${DURATION_LABELS[effect.duration].toLowerCase()} twinkle`;
    case "breathing":
      return `${EFFECT_LABELS.breathing}, ${colorCountLabel(effect.colors.length)}`;
    case "unrecognized":
      return `${EFFECT_LABELS.unrecognized} (${effect.description})`;
    default:
      return EFFECT_LABELS[effect.kind];
  }
}

export function colorCountLabel(count: number): string {
  if (count === 0) return "random colors";
  return count === 1 ? "one color" : `${count} colors`;
}
