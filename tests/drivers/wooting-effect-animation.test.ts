import { describe, expect, it } from "vitest";
import { WOOTING_80HE_LAYOUT } from "../../src/drivers/wooting/wooting-80he-layout";
import { WOOTING_EFFECT_ANIMATOR } from "../../src/drivers/wooting/wooting-effect-animation";
import { WOOTING_EFFECT_CATALOG } from "../../src/drivers/wooting/wooting-effect-catalog";
import { isValidColor, type RgbColor } from "../../src/keyboard/lighting";
import {
  type AnimatedBoard,
  animatedBoardOf,
  type KeyPress,
  type LightingFrameRequest,
} from "../../src/keyboard/lighting-animation";
import {
  type EffectLayer,
  type EffectValues,
  findEffect,
  type LayeredEffects,
  layerFromDescriptor,
} from "../../src/keyboard/lighting-effects";

const ANIMATOR = WOOTING_EFFECT_ANIMATOR;
const CATALOG = WOOTING_EFFECT_CATALOG;
const ROW_LENGTH = 10;
const WHITE: RgbColor = { red: 255, green: 255, blue: 255 };
const RED: RgbColor = { red: 255, green: 0, blue: 0 };
const STATIC_BASE: EffectLayer = { effectId: "static", values: {} };

const ROW_BOARD: AnimatedBoard = {
  keys: Array.from({ length: ROW_LENGTH }, (_, column) => ({ id: `0:${column}`, centerX: column + 0.5, centerY: 0.5 })),
  width: ROW_LENGTH,
  height: 1,
};

function layer(effectId: string, values: EffectValues = {}): EffectLayer {
  const descriptor = findEffect([...CATALOG.baseEffects, ...CATALOG.layerEffects], effectId)!;
  return { effectId, values: { ...layerFromDescriptor(descriptor).values, ...values } };
}

function frame(
  effects: LayeredEffects,
  timeSeconds: number,
  presses: readonly KeyPress[] = [],
  board: AnimatedBoard = ROW_BOARD,
): ReadonlyMap<string, RgbColor> {
  const request: LightingFrameRequest = {
    board,
    effects,
    keyColors: new Map(board.keys.map((key) => [key.id, WHITE])),
    presses,
    timeSeconds,
  };
  return ANIMATOR.frame(request);
}

function withLayers(...effectLayers: EffectLayer[]): LayeredEffects {
  return { base: STATIC_BASE, effectLayers };
}

function press(keyId: string, pressedAt: number, extra: Partial<KeyPress> = {}): KeyPress {
  return { keyId, pressedAt, sequence: 0, depth: 1, ...extra };
}

function brightness(color: RgbColor | undefined): number {
  return color ? (color.red + color.green + color.blue) / 3 : 0;
}

describe("Wooting effect animator", () => {
  it("leaves Static without effect layers to the key colors", () => {
    expect(ANIMATOR.isAnimated(withLayers())).toBe(false);
    expect(ANIMATOR.isAnimated({ base: layer("wave"), effectLayers: [] })).toBe(true);
    expect(ANIMATOR.isAnimated(withLayers(layer("breath")))).toBe(true);
    expect(ANIMATOR.isAnimated(withLayers({ effectId: "unknown-effect-12", values: {} }))).toBe(false);
  });

  it("shows the key colors on a Static base", () => {
    expect(frame(withLayers(), 0).get("0:3")).toEqual(WHITE);
  });

  it("reacts to key presses only with layers that use them", () => {
    expect(ANIMATOR.respondsToKeyPresses({ base: layer("wave"), effectLayers: [] })).toBe(false);
    expect(ANIMATOR.respondsToKeyPresses(withLayers(layer("scan"), layer("breath")))).toBe(false);
    for (const effectId of ["ripple", "trail", "touch", "jelly", "aoe", "mixing", "rt-display"]) {
      expect(ANIMATOR.respondsToKeyPresses(withLayers(layer(effectId)))).toBe(true);
    }
  });

  it("draws valid colors for every key with every effect", () => {
    const board = animatedBoardOf(WOOTING_80HE_LAYOUT);
    const presses = [press("3:4", 0.2), press("2:1", 0.1, { releasedAt: 0.3, sequence: 1 })];
    for (const base of CATALOG.baseEffects) {
      for (const layerEffect of CATALOG.layerEffects) {
        const effects = { base: layerFromDescriptor(base), effectLayers: [layerFromDescriptor(layerEffect)] };
        const colors = frame(effects, 0.5, presses, board);
        expect(colors.size).toBe(board.keys.length);
        for (const color of colors.values()) expect(isValidColor(color)).toBe(true);
      }
    }
  });

  it("starts Cycle on the first color of its look and lights every key the same", () => {
    const colors = frame({ base: layer("cycle", { look: 0 }), effectLayers: [] }, 0);
    expect(colors.get("0:0")).toEqual(RED);
    expect(new Set([...colors.values()].map((color) => JSON.stringify(color))).size).toBe(1);
  });

  it("moves Wave in its direction", () => {
    const period = 16 * 0.25;
    const keyWidthInTime = period / ROW_LENGTH;
    const rightward = { base: layer("wave", { speed: 16, direction: 0 }), effectLayers: [] };
    expect(frame(rightward, keyWidthInTime).get("0:5")).toEqual(frame(rightward, 0).get("0:4"));
    const leftward = { base: layer("wave", { speed: 16, direction: 1 }), effectLayers: [] };
    expect(frame(leftward, keyWidthInTime).get("0:4")).toEqual(frame(leftward, 0).get("0:5"));
  });

  it("mixes the two colors of Noise and Spiral", () => {
    const blue: RgbColor = { red: 0, green: 0, blue: 255 };
    for (const effectId of ["noise", "spiral"]) {
      const effects = { base: layer(effectId, { primaryColor: RED, secondaryColor: blue }), effectLayers: [] };
      for (const color of frame(effects, 1.3).values()) {
        expect(color.green).toBe(0);
        expect(color.red + color.blue).toBeGreaterThanOrEqual(254);
        expect(color.red + color.blue).toBeLessThanOrEqual(256);
      }
    }
  });

  it("breathes between full and the secondary brightness", () => {
    const effects = withLayers(layer("breath", { speed: 8, secondaryBrightness: 51 }));
    expect(frame(effects, 0).get("0:0")).toEqual(WHITE);
    expect(frame(effects, 1).get("0:0")).toEqual({ red: 51, green: 51, blue: 51 });
  });

  it("sweeps the Scan bar over the base brightness", () => {
    const effects = withLayers(layer("scan", { width: 1, speed: 10, baseBrightness: 0, direction: 0 }));
    const colors = frame(effects, 0.4);
    const brightest = [...colors].sort(([, first], [, second]) => brightness(second) - brightness(first))[0][0];
    expect(brightest).toBe("0:2");
    expect(colors.get("0:8")).toEqual({ red: 0, green: 0, blue: 0 });
  });

  it("lights a touched key fully and the others at the base brightness", () => {
    const effects = withLayers(layer("touch", { baseBrightness: 51, useAnalogCurve: false }));
    const colors = frame(effects, 1, [press("0:2", 0.5, { depth: 0.3 })]);
    expect(colors.get("0:2")).toEqual(WHITE);
    expect(colors.get("0:3")).toEqual({ red: 51, green: 51, blue: 51 });
  });

  it("follows the press depth with the analog curve", () => {
    const effects = withLayers(layer("touch", { baseBrightness: 0, useAnalogCurve: true }));
    expect(frame(effects, 1, [press("0:2", 0.5, { depth: 0.5 })]).get("0:2")).toEqual({
      red: 128,
      green: 128,
      blue: 128,
    });
  });

  it("spreads a Ripple ring away from the pressed key and lets it fade", () => {
    const effects = withLayers(layer("ripple", { spreadSpeed: 10, fadeSpeed: 100, baseBrightness: 0 }));
    const presses = [press("0:0", 0, { releasedAt: 0.05 })];
    const colors = frame(effects, 0.3, presses);
    expect(brightness(colors.get("0:3"))).toBeGreaterThan(brightness(colors.get("0:0")));
    expect(brightness(colors.get("0:3"))).toBeGreaterThan(brightness(colors.get("0:7")));
    expect(brightness(frame(effects, 2, presses).get("0:3"))).toBe(0);
  });

  it("fades a Trail after the key is released, in its single color", () => {
    const effects = withLayers(layer("trail", { speed: 4, baseBrightness: 0, colorMode: 2, customColor: RED }));
    const presses = [press("0:4", 0, { releasedAt: 1 })];
    expect(frame(effects, 0.5, presses).get("0:4")).toEqual(RED);
    expect(frame(effects, 1.5, presses).get("0:4")).toEqual({ red: 128, green: 0, blue: 0 });
    expect(frame(effects, 3, presses).get("0:4")).toEqual({ red: 0, green: 0, blue: 0 });
  });

  it("lights an area around the key held for AOE and Jelly", () => {
    for (const effectId of ["aoe", "jelly"]) {
      const effects = withLayers(layer(effectId, { baseBrightness: 0, useAnalogCurve: false }));
      const colors = frame(effects, 1, [press("0:5", 0.9)]);
      expect(brightness(colors.get("0:5"))).toBe(255);
      expect(brightness(colors.get("0:6"))).toBeGreaterThan(0);
      expect(brightness(colors.get("0:0"))).toBe(0);
    }
  });

  it("applies effect layers in order over the base", () => {
    const effects = withLayers(
      layer("breath", { speed: 8, secondaryBrightness: 0 }),
      layer("rt-display", { baseBrightness: 0 }),
    );
    const colors = frame(effects, 1, [press("0:1", 0.5)]);
    expect(colors.get("0:1")).toEqual({ red: 0, green: 0, blue: 0 });
    expect(frame(effects, 0, [press("0:1", 0)]).get("0:1")).toEqual(WHITE);
  });
});
