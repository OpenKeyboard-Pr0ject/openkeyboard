import { describe, expect, it } from "vitest";
import {
  BASE_LAYER_SELECTION,
  canAddEffectLayer,
  draftFromState,
  hasChanges,
  lightingChangeFromDraft,
  selectionAfterRemoving,
  withAddedEffectLayer,
  withBaseEffect,
  withBrightness,
  withKeyColor,
  withLayerEffect,
  withoutEffectLayer,
  withParameterValue,
  withPreset,
} from "../../src/app/pages/lighting/lighting-draft";
import { WOOTING_EFFECT_CATALOG } from "../../src/drivers/wooting/wooting-effect-catalog";
import type { LightingState } from "../../src/keyboard/lighting";

const CATALOG = WOOTING_EFFECT_CATALOG;

const WAVE_STATE: LightingState = {
  brightnessPercent: 100,
  effect: { kind: "layered", description: "Wave" },
  keyColors: [
    { matrixRow: 0, matrixColumn: 0, color: { red: 255, green: 0, blue: 0 } },
    { matrixRow: 2, matrixColumn: 1, color: { red: 0, green: 0, blue: 255 } },
  ],
  layeredEffects: { base: { effectId: "wave", values: { look: 0, speed: 16, direction: 0 } }, effectLayers: [] },
};

const stored = draftFromState(WAVE_STATE, CATALOG);

describe("lighting draft", () => {
  it("starts from the stored colors, brightness and effects", () => {
    expect(stored.brightnessPercent).toBe(100);
    expect(stored.keyColors.get("2:1")).toBe("#0000ff");
    expect(stored.effects.base.effectId).toBe("wave");
    expect(hasChanges(stored, stored)).toBe(false);
  });

  it("selects a base effect with Wootility's defaults", () => {
    const cycle = withBaseEffect(stored, CATALOG, "cycle");

    expect(cycle.effects.base).toEqual({ effectId: "cycle", values: { look: 0, speed: 48 } });
  });

  it("keeps the base effect's settings when the same effect is selected again", () => {
    const fast = withParameterValue(stored, BASE_LAYER_SELECTION, "speed", 4);

    expect(withBaseEffect(fast, CATALOG, "wave")).toBe(fast);
  });

  it("adds Scan as a new effect layer, as Wootility does, up to three layers", () => {
    let draft = stored;
    for (let count = 0; count < 4; count += 1) draft = withAddedEffectLayer(draft, CATALOG);

    expect(draft.effects.effectLayers.map((layer) => layer.effectId)).toEqual(["scan", "scan", "scan"]);
    expect(canAddEffectLayer(draft, CATALOG)).toBe(false);
  });

  it("changes and removes effect layers", () => {
    const twoLayers = withAddedEffectLayer(withAddedEffectLayer(stored, CATALOG), CATALOG);
    const withTrail = withLayerEffect(twoLayers, CATALOG, 1, "trail");

    expect(withTrail.effects.effectLayers[1]).toEqual({
      effectId: "trail",
      values: {
        baseBrightness: 30,
        speed: 4,
        colorMode: 0,
        fadeDirection: 0,
        customColor: { red: 255, green: 255, blue: 255 },
      },
    });
    expect(withoutEffectLayer(withTrail, 0).effects.effectLayers.map((layer) => layer.effectId)).toEqual(["trail"]);
  });

  it("edits a parameter of the selected effect layer", () => {
    const withLayer = withAddedEffectLayer(stored, CATALOG);

    const vertical = withParameterValue(withLayer, { kind: "effect-layer", index: 0 }, "direction", 3);

    expect(vertical.effects.effectLayers[0].values.direction).toBe(3);
    expect(vertical.effects.base).toBe(stored.effects.base);
  });

  it("applies a preset as key colors on a Static base without effect layers", () => {
    const seawave = CATALOG.presets.find((preset) => preset.name === "Seawave")!;

    const draft = withPreset(withAddedEffectLayer(stored, CATALOG), CATALOG, seawave);

    expect(draft.effects).toEqual({ base: { effectId: "static", values: {} }, effectLayers: [] });
    expect(draft.keyColors.get("0:0")).toBe("#0000ff");
    expect(draft.keyColors.size).toBe(126);
  });

  it("moves the layer selection when a layer before it is removed", () => {
    expect(selectionAfterRemoving({ kind: "effect-layer", index: 2 }, 0)).toEqual({ kind: "effect-layer", index: 1 });
    expect(selectionAfterRemoving({ kind: "effect-layer", index: 1 }, 1)).toEqual(BASE_LAYER_SELECTION);
    expect(selectionAfterRemoving({ kind: "effect-layer", index: 0 }, 1)).toEqual({ kind: "effect-layer", index: 0 });
  });

  describe("change to save", () => {
    it("lists only key colors that changed", () => {
      const draft = withKeyColor(stored, ["2:1", "0:0"], "#ff0000");

      expect(lightingChangeFromDraft(stored, draft)).toEqual({
        keyColors: [{ matrixRow: 2, matrixColumn: 1, color: { red: 255, green: 0, blue: 0 } }],
      });
    });

    it("includes brightness and effects only when they changed", () => {
      const draft = withBaseEffect(withBrightness(stored, 80), CATALOG, "static");

      expect(lightingChangeFromDraft(stored, draft)).toEqual({
        brightnessPercent: 80,
        layeredEffects: { base: { effectId: "static", values: {} }, effectLayers: [] },
      });
    });

    it("is empty after changes are undone by hand", () => {
      const draft = withParameterValue(withParameterValue(stored, BASE_LAYER_SELECTION, "speed", 40),
        BASE_LAYER_SELECTION, "speed", 16);

      expect(lightingChangeFromDraft(stored, draft)).toEqual({});
    });
  });
});
