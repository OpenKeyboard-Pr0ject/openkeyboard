import { describe, expect, it } from "vitest";
import {
  effectFromDraft,
  initialEffectDraft,
  initialEffectKind,
  lightingChange,
} from "../../src/app/pages/lighting/effect-draft";
import type { LightingEffect, LightingState } from "../../src/keyboard/lighting";

const red = { red: 255, green: 0, blue: 0 };
const blue = { red: 0, green: 0, blue: 255 };
const SUPPORTED = ["static", "spectrum", "breathing", "wave", "reactive", "starlight", "off"] as const;

describe("initialEffectKind", () => {
  it("starts from the current effect", () => {
    expect(initialEffectKind({ kind: "wave", direction: "right-to-left" }, SUPPORTED)).toBe("wave");
  });

  it("falls back to the first supported effect for an unrecognized one", () => {
    expect(initialEffectKind({ kind: "unrecognized", description: "Effect 0x08" }, SUPPORTED)).toBe("static");
  });
});

describe("initialEffectDraft", () => {
  it("starts with the current colors, then white and blue", () => {
    const current: LightingEffect = { kind: "static", color: red };

    expect(initialEffectDraft("breathing", current, 2).colors).toEqual(["#ff0000", "#ffffff"]);
  });

  it("keeps the current color count when the effect stays the same", () => {
    const current: LightingEffect = { kind: "breathing", colors: [red, blue] };

    expect(initialEffectDraft("breathing", current, 2).colorCount).toBe(2);
  });

  it("starts another multi-color effect with one color", () => {
    const current: LightingEffect = { kind: "breathing", colors: [] };

    expect(initialEffectDraft("starlight", current, 2).colorCount).toBe(1);
  });

  it("keeps duration and direction from the current effect, otherwise medium and left to right", () => {
    const fromReactive = initialEffectDraft("starlight", { kind: "reactive", color: red, duration: "long" }, 2);
    const fromSpectrum = initialEffectDraft("wave", { kind: "spectrum" }, 2);

    expect(fromReactive.duration).toBe("long");
    expect([fromSpectrum.duration, fromSpectrum.direction]).toEqual(["medium", "left-to-right"]);
  });
});

describe("effectFromDraft", () => {
  const draft = initialEffectDraft("static", { kind: "spectrum" }, 2);

  it.each([
    [{ kind: "static" }, { kind: "static", color: { red: 255, green: 255, blue: 255 } }],
    [{ kind: "spectrum" }, { kind: "spectrum" }],
    [{ kind: "wave", direction: "right-to-left" }, { kind: "wave", direction: "right-to-left" }],
    [{ kind: "breathing", colorCount: 0 }, { kind: "breathing", colors: [] }],
    [{ kind: "starlight", colorCount: 2, duration: "short" }, {
      kind: "starlight",
      colors: [{ red: 255, green: 255, blue: 255 }, blue],
      duration: "short",
    }],
  ] as const)("builds %j", (changes, expected) => {
    expect(effectFromDraft({ ...draft, ...changes })).toEqual(expected);
  });
});

describe("lightingChange", () => {
  const current: LightingState = { brightnessPercent: 60, effect: { kind: "spectrum" } };

  it("is empty when nothing changed", () => {
    expect(lightingChange(current, 60, initialEffectDraft("spectrum", current.effect, 2))).toEqual({});
  });

  it("contains the brightness and effect that changed", () => {
    const draft = initialEffectDraft("static", current.effect, 2);

    expect(lightingChange(current, 40, draft)).toEqual({
      brightnessPercent: 40,
      effect: { kind: "static", color: { red: 255, green: 255, blue: 255 } },
    });
  });
});
