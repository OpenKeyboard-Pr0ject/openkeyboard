import {
  assertValidBrightness,
  effectColors,
  isValidColor,
  type KeyboardLightingEditor,
  type KeyboardLightingReader,
  type LightingChange,
  type LightingState,
  sameLightingEffect,
  KeyColorsNotSupportedError,
  UnsupportedLightingEffectError,
  type WritableLightingEffect,
  type WritableLightingEffectKind,
} from "../../keyboard/lighting";
import type { RazerCommandChannel } from "../../protocol/razer/razer-command-channel";
import { RazerCommands } from "../../protocol/razer/razer-constants";
import {
  backlightAddress,
  brightnessToPercent,
  decodeBrightnessPercent,
  decodeEffect,
  encodeBrightnessArguments,
  encodeEffectArguments,
  MAXIMUM_EFFECT_COLORS,
  percentToBrightness,
} from "../../protocol/razer/razer-lighting-codec";
import { assertSettingsKept, type WrittenSetting } from "./razer-write-verification";

const RAZER_LIGHTING_EFFECTS: readonly WritableLightingEffectKind[] = [
  "static",
  "spectrum",
  "breathing",
  "wave",
  "reactive",
  "starlight",
  "off",
];

const SINGLE_COLOR_EFFECTS: ReadonlySet<WritableLightingEffectKind> = new Set(["static", "reactive"]);

export class RazerLighting implements KeyboardLightingReader, KeyboardLightingEditor {
  readonly supportedEffects = RAZER_LIGHTING_EFFECTS;
  readonly maximumEffectColors = MAXIMUM_EFFECT_COLORS;
  readonly supportsKeyColors = false;

  constructor(private readonly channel: RazerCommandChannel) {}

  async readLighting(): Promise<LightingState> {
    const brightnessReply = await this.channel.request(RazerCommands.getMatrixBrightness, backlightAddress());
    const effectReply = await this.channel.request(RazerCommands.getMatrixEffect, backlightAddress());
    return { brightnessPercent: decodeBrightnessPercent(brightnessReply), effect: decodeEffect(effectReply) };
  }

  async updateLighting(change: LightingChange): Promise<LightingState> {
    validate(change);
    await this.write(change);
    const stored = await this.readLighting();
    assertSettingsKept(keptSettings(change, stored));
    return stored;
  }

  private async write(change: LightingChange): Promise<void> {
    if (change.effect) {
      await this.channel.request(RazerCommands.setMatrixEffect, encodeEffectArguments(change.effect));
    }
    if (change.brightnessPercent !== undefined) {
      const brightnessArguments = encodeBrightnessArguments(change.brightnessPercent);
      await this.channel.request(RazerCommands.setMatrixBrightness, brightnessArguments);
    }
  }
}

function validate(change: LightingChange): void {
  if (change.keyColors) throw new KeyColorsNotSupportedError();
  if (change.brightnessPercent !== undefined) assertValidBrightness(change.brightnessPercent);
  if (change.effect) assertWritableEffect(change.effect);
}

function keptSettings(change: LightingChange, stored: LightingState): WrittenSetting[] {
  const { effect, brightnessPercent } = change;
  return [
    ...(effect ? [{ name: "lighting effect", kept: sameLightingEffect(stored.effect, effect) }] : []),
    ...(brightnessPercent !== undefined
      ? [{ name: "brightness", kept: stored.brightnessPercent === storedPercentOf(brightnessPercent) }]
      : []),
  ];
}

function storedPercentOf(percent: number): number {
  return brightnessToPercent(percentToBrightness(percent));
}

function assertWritableEffect(effect: WritableLightingEffect): void {
  if (!RAZER_LIGHTING_EFFECTS.includes(effect.kind)) {
    throw new UnsupportedLightingEffectError(effect, "this keyboard does not offer it.");
  }
  const colors = effectColors(effect);
  if (!colors.every(isValidColor)) {
    throw new UnsupportedLightingEffectError(effect, "every color channel must be a whole number from 0 to 255.");
  }
  if (colors.length > MAXIMUM_EFFECT_COLORS) {
    throw new UnsupportedLightingEffectError(effect, `it takes at most ${MAXIMUM_EFFECT_COLORS} colors.`);
  }
  if (SINGLE_COLOR_EFFECTS.has(effect.kind) && colors.length !== 1) {
    throw new UnsupportedLightingEffectError(effect, "it takes exactly one color.");
  }
}
