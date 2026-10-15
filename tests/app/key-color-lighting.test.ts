import { describe, expect, it } from "vitest";
import { lightingChangeFrom } from "../../src/app/pages/lighting/KeyColorLightingForm";
import type { LayoutKey } from "../../src/keyboard/physical-layout";

const ESCAPE: LayoutKey = { label: "Esc", matrixRow: 0, matrixColumn: 0, x: 0, y: 0, width: 1, height: 1 };
const Q: LayoutKey = { label: "Q", matrixRow: 2, matrixColumn: 1, x: 1.5, y: 2.25, width: 1, height: 1 };
const STORED = new Map([["0:0", "#ff0000"], ["2:1", "#ff0000"]]);

describe("key color lighting change", () => {
  it("lists only keys whose color changed", () => {
    const draft = new Map([["0:0", "#ff0000"], ["2:1", "#0000ff"]]);

    expect(lightingChangeFrom([ESCAPE, Q], STORED, draft, 90, 90)).toEqual({
      keyColors: [{ matrixRow: 2, matrixColumn: 1, color: { red: 0, green: 0, blue: 255 } }],
    });
  });

  it("includes the brightness only when it changed", () => {
    expect(lightingChangeFrom([ESCAPE, Q], STORED, STORED, 90, 100)).toEqual({ brightnessPercent: 100 });
  });

  it("is empty when nothing changed", () => {
    expect(lightingChangeFrom([ESCAPE, Q], STORED, STORED, 90, 90)).toEqual({});
  });
});
