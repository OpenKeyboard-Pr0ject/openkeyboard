import { describe, expect, it } from "vitest";
import type { LightingEffect, WritableLightingEffect } from "../../src/keyboard/lighting";
import { RazerProtocolError } from "../../src/protocol/razer/razer-codec";
import {
  brightnessToPercent,
  decodeBrightnessPercent,
  decodeEffect,
  encodeBrightnessArguments,
  encodeEffectArguments,
  percentToBrightness,
} from "../../src/protocol/razer/razer-lighting-codec";
import { verifiedEffectWrites } from "../fakes/razer-blackwidow-v3-mini-captures";
import { payloadOf } from "../fakes/wooting-80he-captures";

const red = { red: 0xff, green: 0, blue: 0 };
const green = { red: 0, green: 0xff, blue: 0 };
const blue = { red: 0, green: 0, blue: 0xff };

const effectsByLabel: Readonly<Record<string, WritableLightingEffect>> = {
  "static red": { kind: "static", color: red },
  "breathing green": { kind: "breathing", colors: [green] },
  "breathing red and blue": { kind: "breathing", colors: [red, blue] },
  "breathing random": { kind: "breathing", colors: [] },
  "reactive blue short": { kind: "reactive", color: blue, duration: "short" },
  "reactive blue long": { kind: "reactive", color: blue, duration: "long" },
  "starlight green medium": { kind: "starlight", colors: [green], duration: "medium" },
  "starlight red and blue short": { kind: "starlight", colors: [red, blue], duration: "short" },
  "starlight random long": { kind: "starlight", colors: [], duration: "long" },
  "wave left to right": { kind: "wave", direction: "left-to-right" },
  "wave right to left": { kind: "wave", direction: "right-to-left" },
  off: { kind: "off" },
  spectrum: { kind: "spectrum" },
};

describe("Razer lighting effects verified on the BlackWidow V3 Mini", () => {
  it.each(verifiedEffectWrites)("encodes $label as the keyboard stored it", ({ label, effectArgumentsHex }) => {
    expect(encodeEffectArguments(effectsByLabel[label])).toEqual([...payloadOf(effectArgumentsHex)]);
  });

  it.each(verifiedEffectWrites)("decodes $label from the bytes read back", ({ label, effectArgumentsHex }) => {
    expect(decodeEffect(payloadOf(effectArgumentsHex))).toEqual(effectsByLabel[label]);
  });
});

describe("decodeEffect", () => {
  it("names an effect id it does not know", () => {
    const customFrame = payloadOf("010508000000");

    expect(decodeEffect(customFrame)).toEqual<LightingEffect>({ kind: "unrecognized", description: "Effect 0x08" });
  });

  it("treats a static effect without its color as unrecognized", () => {
    expect(decodeEffect(payloadOf("010501000000")).kind).toBe("unrecognized");
  });

  it("treats a wave with an unknown direction as unrecognized", () => {
    expect(decodeEffect(payloadOf("010504002800")).kind).toBe("unrecognized");
  });

  it("rejects a reply without an effect id", () => {
    expect(() => decodeEffect(payloadOf("0105"))).toThrow(RazerProtocolError);
  });
});

describe("encodeEffectArguments", () => {
  it("refuses more colors than the keyboard stores", () => {
    expect(() => encodeEffectArguments({ kind: "breathing", colors: [red, green, blue] })).toThrow(RazerProtocolError);
  });
});

describe("brightness", () => {
  it("reads the captured 0x99 as 60 %", () => {
    expect(decodeBrightnessPercent(payloadOf("010599"))).toBe(60);
  });

  it("writes 40 % as 0x66 on the backlight", () => {
    expect(encodeBrightnessArguments(40)).toEqual([0x01, 0x05, 0x66]);
  });

  it("maps every whole percent back to itself", () => {
    const percents = Array.from({ length: 101 }, (_, percent) => percent);

    expect(percents.map((percent) => brightnessToPercent(percentToBrightness(percent)))).toEqual(percents);
  });

  it("rejects a reply without the brightness byte", () => {
    expect(() => decodeBrightnessPercent(payloadOf("0105"))).toThrow(RazerProtocolError);
  });
});
