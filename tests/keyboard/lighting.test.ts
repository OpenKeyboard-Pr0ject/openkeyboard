import { describe, expect, it } from "vitest";
import {
  assertValidBrightness,
  BrightnessOutOfRangeError,
  colorFromHex,
  colorToHex,
  InvalidColorError,
  sameLightingEffect,
} from "../../src/keyboard/lighting";

describe("colors", () => {
  it("formats a color as lowercase #rrggbb", () => {
    expect(colorToHex({ red: 0xff, green: 0x0a, blue: 0x00 })).toBe("#ff0a00");
  });

  it("parses a #rrggbb color in any case", () => {
    expect(colorFromHex("#44D62C")).toEqual({ red: 0x44, green: 0xd6, blue: 0x2c });
  });

  it("rejects text that is not a #rrggbb color", () => {
    expect(() => colorFromHex("red")).toThrow(InvalidColorError);
  });
});

describe("sameLightingEffect", () => {
  it("compares by meaning regardless of property order", () => {
    const fromForm = { duration: "long", color: { blue: 255, green: 0, red: 0 }, kind: "reactive" } as const;
    const fromKeyboard = { kind: "reactive", color: { red: 0, green: 0, blue: 255 }, duration: "long" } as const;

    expect(sameLightingEffect(fromForm, fromKeyboard)).toBe(true);
  });

  it("tells apart effects that differ in one color", () => {
    const first = { kind: "breathing", colors: [{ red: 255, green: 0, blue: 0 }] } as const;
    const second = { kind: "breathing", colors: [{ red: 254, green: 0, blue: 0 }] } as const;

    expect(sameLightingEffect(first, second)).toBe(false);
  });

  it("tells apart wave directions", () => {
    expect(sameLightingEffect(
      { kind: "wave", direction: "left-to-right" },
      { kind: "wave", direction: "right-to-left" },
    )).toBe(false);
  });
});

describe("assertValidBrightness", () => {
  it("accepts whole percents from 0 to 100", () => {
    expect(() => [0, 1, 99, 100].forEach(assertValidBrightness)).not.toThrow();
  });

  it("rejects a fraction", () => {
    expect(() => assertValidBrightness(12.5)).toThrow(BrightnessOutOfRangeError);
  });
});
