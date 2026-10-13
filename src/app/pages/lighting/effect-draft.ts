import {
  colorFromHex,
  colorToHex,
  type EffectDuration,
  effectColors,
  type LightingChange,
  type LightingEffect,
  type LightingState,
  type RgbColor,
  sameLightingEffect,
  type WaveDirection,
  type WritableLightingEffect,
  type WritableLightingEffectKind,
} from "../../../keyboard/lighting";

export interface EffectDraft {
  readonly kind: WritableLightingEffectKind;
  readonly colors: readonly string[];
  readonly colorCount: number;
  readonly duration: EffectDuration;
  readonly direction: WaveDirection;
}

const FALLBACK_COLORS: readonly RgbColor[] = [
  { red: 0xff, green: 0xff, blue: 0xff },
  { red: 0x00, green: 0x00, blue: 0xff },
];
const DEFAULT_DURATION: EffectDuration = "medium";
const DEFAULT_DIRECTION: WaveDirection = "left-to-right";
const MULTI_COLOR_EFFECTS: ReadonlySet<WritableLightingEffectKind> = new Set(["breathing", "starlight"]);

export function initialEffectKind(
  current: LightingEffect,
  supportedEffects: readonly WritableLightingEffectKind[],
): WritableLightingEffectKind {
  return supportedEffects.find((kind) => kind === current.kind) ?? supportedEffects[0];
}

export function initialEffectDraft(
  kind: WritableLightingEffectKind,
  current: LightingEffect,
  maximumColors: number,
): EffectDraft {
  const startingColors = [...effectColors(current), ...FALLBACK_COLORS].map(colorToHex);
  return {
    kind,
    colors: startingColors.slice(0, Math.max(maximumColors, 1)),
    colorCount: Math.min(colorCountOf(current, kind), maximumColors),
    duration: "duration" in current ? current.duration : DEFAULT_DURATION,
    direction: "direction" in current ? current.direction : DEFAULT_DIRECTION,
  };
}

export function usesColorCount(kind: WritableLightingEffectKind): boolean {
  return MULTI_COLOR_EFFECTS.has(kind);
}

export function effectFromDraft(draft: EffectDraft): WritableLightingEffect {
  const firstColor = colorFromHex(draft.colors[0]);
  const selectedColors = draft.colors.slice(0, draft.colorCount).map(colorFromHex);
  switch (draft.kind) {
    case "off":
    case "spectrum":
      return { kind: draft.kind };
    case "static":
      return { kind: "static", color: firstColor };
    case "reactive":
      return { kind: "reactive", color: firstColor, duration: draft.duration };
    case "wave":
      return { kind: "wave", direction: draft.direction };
    case "breathing":
      return { kind: "breathing", colors: selectedColors };
    case "starlight":
      return { kind: "starlight", colors: selectedColors, duration: draft.duration };
  }
}

export function lightingChange(current: LightingState, brightnessPercent: number, draft: EffectDraft): LightingChange {
  const effect = effectFromDraft(draft);
  return {
    ...(brightnessPercent !== current.brightnessPercent ? { brightnessPercent } : {}),
    ...(!sameLightingEffect(effect, current.effect) ? { effect } : {}),
  };
}

function colorCountOf(current: LightingEffect, kind: WritableLightingEffectKind): number {
  return current.kind === kind && "colors" in current ? current.colors.length : 1;
}
