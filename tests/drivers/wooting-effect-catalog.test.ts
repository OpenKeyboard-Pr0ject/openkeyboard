import { describe, expect, it } from "vitest";
import { WOOTING_EFFECT_CATALOG } from "../../src/drivers/wooting/wooting-effect-catalog";
import {
  assertValidLayeredEffects,
  displayedParameterValue,
  findEffect,
  layerFromDescriptor,
  type SliderParameter,
} from "../../src/keyboard/lighting-effects";
import { typingRgbCorePayload } from "../fakes/wooting-80he-captures";
import { withRgbEffects } from "../../src/protocol/wooting/wooting-rgb-effects-codec";

const CATALOG = WOOTING_EFFECT_CATALOG;

function slider(effectId: string, parameterId: string): SliderParameter {
  const effects = [...CATALOG.baseEffects, ...CATALOG.layerEffects];
  return findEffect(effects, effectId)!.parameters.find((parameter) => parameter.id === parameterId) as SliderParameter;
}

describe("Wooting effect catalog", () => {
  it("lists the effects in Wootility's order", () => {
    expect(CATALOG.baseEffects.map((effect) => effect.label)).toEqual(["Static", "Wave", "Cycle", "Noise", "Spiral"]);
    expect(CATALOG.layerEffects.map((effect) => effect.label)).toEqual([
      "Jelly", "Scan", "Breath", "Ripple", "Touch", "AOE", "Mixing", "Trail", "RT display",
    ]);
  });

  it("has defaults that are valid and encodable for every effect", () => {
    for (const base of CATALOG.baseEffects) {
      for (const layerEffect of CATALOG.layerEffects) {
        const effects = { base: layerFromDescriptor(base), effectLayers: [layerFromDescriptor(layerEffect)] };
        expect(() => assertValidLayeredEffects(CATALOG, effects)).not.toThrow();
        expect(() => withRgbEffects(typingRgbCorePayload, effects)).not.toThrow();
      }
    }
  });

  it("gives every parameter a default value", () => {
    for (const effect of [...CATALOG.baseEffects, ...CATALOG.layerEffects]) {
      expect(Object.keys(effect.defaults).sort()).toEqual(effect.parameters.map((parameter) => parameter.id).sort());
    }
  });

  it.each([
    ["wave", "speed", 16, "4.00 s"],
    ["cycle", "speed", 48, "12.00 s"],
    ["noise", "speed", 50, "20 %"],
    ["spiral", "spinSpeed", 50, "39 %"],
    ["spiral", "spiralSpeed", 70, "55 %"],
    ["scan", "baseBrightness", 30, "12 %"],
    ["breath", "speed", 15, "3.75 s"],
    ["breath", "secondaryBrightness", 87, "34 %"],
    ["ripple", "fadeSpeed", 30, "0.45 s"],
    ["ripple", "fadeSpeed", 138, "2.07 s"],
    ["ripple", "baseBrightness", 32, "13 %"],
    ["trail", "speed", 4, "1.00 s"],
    ["rt-display", "baseBrightness", 140, "55 %"],
  ])("shows %s %s %i as Wootility does: %s", (effectId, parameterId, raw, shown) => {
    expect(displayedParameterValue(slider(effectId, parameterId), raw)).toBe(shown);
  });

  it("offers nine presets that each color the whole matrix", () => {
    expect(CATALOG.presets.map((preset) => preset.name)).toEqual([
      "Rainbow", "Seawave", "Inferno", "Miami FPS", "Summer Breeze", "Alternator", "Clay", "Lekker", "Sunset",
    ]);
    for (const preset of CATALOG.presets) expect(preset.keyColors).toHaveLength(126);
  });
});
