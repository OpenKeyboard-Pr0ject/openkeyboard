import { describe, expect, it } from "vitest";
import {
  assertValidLayeredEffects,
  baseHidesKeyColors,
  describeLayeredEffects,
  InvalidLayeredEffectsError,
  isParameterVisible,
  type LayeredEffectCatalog,
  sameLayeredEffects,
} from "../../src/keyboard/lighting-effects";

const CATALOG: LayeredEffectCatalog = {
  keyColorLayers: [{ name: "Main", editable: true }],
  baseEffects: [
    { id: "solid", label: "Solid", parameters: [], defaults: {} },
    {
      id: "pulse",
      label: "Pulse",
      parameters: [
        { kind: "slider", id: "speed", label: "Speed", min: 1, max: 10, display: { scale: 1, decimals: 0, unit: "" } },
        { kind: "toggle", id: "reverse", label: "Reverse" },
      ],
      defaults: { speed: 5, reverse: false },
    },
  ],
  layerEffects: [
    {
      id: "glow",
      label: "Glow",
      parameters: [
        {
          kind: "choice",
          id: "mode",
          label: "Mode",
          options: [{ value: 0, label: "Base" }, { value: 2, label: "Single" }],
          presentation: "buttons",
        },
        { kind: "color", id: "tint", label: "Tint", visibleWhen: { parameterId: "mode", equals: 2 } },
      ],
      defaults: { mode: 0, tint: { red: 0, green: 0, blue: 0 } },
    },
  ],
  maximumEffectLayers: 1,
  newEffectLayerId: "glow",
  keyColorsBaseEffectId: "solid",
  presets: [],
};

const PULSE = { effectId: "pulse", values: { speed: 5, reverse: false } };
const GLOW = { effectId: "glow", values: { mode: 2, tint: { red: 1, green: 2, blue: 3 } } };

describe("layered lighting effects", () => {
  it("accepts effects that match the catalog", () => {
    expect(() => assertValidLayeredEffects(CATALOG, { base: PULSE, effectLayers: [GLOW] })).not.toThrow();
  });

  it.each([
    ["an unknown base effect", { base: { effectId: "fire", values: {} }, effectLayers: [] }],
    ["a layer effect used as base", { base: GLOW, effectLayers: [] }],
    ["a slider out of range", { base: { ...PULSE, values: { speed: 11, reverse: false } }, effectLayers: [] }],
    ["a fractional slider value", { base: { ...PULSE, values: { speed: 2.5, reverse: false } }, effectLayers: [] }],
    ["a missing toggle", { base: { ...PULSE, values: { speed: 5 } }, effectLayers: [] }],
    ["a choice outside the options", { base: PULSE, effectLayers: [{ ...GLOW, values: { ...GLOW.values, mode: 1 } }] }],
    ["an invalid color", {
      base: PULSE,
      effectLayers: [{ ...GLOW, values: { mode: 2, tint: { red: 300, green: 0, blue: 0 } } }],
    }],
    ["too many layers", { base: PULSE, effectLayers: [GLOW, GLOW] }],
  ])("refuses %s", (_case, effects) => {
    expect(() => assertValidLayeredEffects(CATALOG, effects)).toThrow(InvalidLayeredEffectsError);
  });

  it("describes the base effect and its layers", () => {
    expect(describeLayeredEffects(CATALOG, { base: PULSE, effectLayers: [] })).toBe("Pulse");
    expect(describeLayeredEffects(CATALOG, { base: PULSE, effectLayers: [GLOW] })).toBe("Pulse with Glow");
    expect(describeLayeredEffects(CATALOG, {
      base: PULSE,
      effectLayers: [GLOW, { effectId: "mystery", values: {} }, GLOW],
    })).toBe("Pulse with Glow, an unrecognized effect and Glow");
  });

  it("knows which base effects cover the key colors", () => {
    expect(baseHidesKeyColors(CATALOG, { base: PULSE, effectLayers: [] })).toBe(true);
    expect(baseHidesKeyColors(CATALOG, { base: { effectId: "solid", values: {} }, effectLayers: [GLOW] })).toBe(false);
  });

  it("shows a parameter only when its condition holds", () => {
    const tint = CATALOG.layerEffects[0].parameters[1];

    expect(isParameterVisible(tint, { mode: 2 })).toBe(true);
    expect(isParameterVisible(tint, { mode: 0 })).toBe(false);
  });

  it("compares effects regardless of value order", () => {
    const reordered = { effectId: "pulse", values: { reverse: false, speed: 5 } };

    expect(sameLayeredEffects({ base: PULSE, effectLayers: [] }, { base: reordered, effectLayers: [] })).toBe(true);
  });
});
