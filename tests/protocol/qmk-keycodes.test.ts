import { describe, expect, it } from "vitest";
import { qmkKeycodeLabel } from "../../src/protocol/via/qmk-keycodes";

describe("qmkKeycodeLabel with modern (v6) keycodes", () => {
  it.each([
    [0x0000, ""],
    [0x0001, "▽"],
    [0x0004, "A"],
    [0x002c, "Space"],
    [0x0068, "F13"],
    [0x00a9, "Volume Up"],
    [0x00d1, "Mouse 1"],
    [0x00e1, "Left Shift"],
    [0x0204, "Shift+A"],
    [0x1204, "Right Shift+A"],
    [0x0504, "Ctrl+Alt+A"],
    [0x2104, "MT(Ctrl, A)"],
    [0x412c, "LT(1, Space)"],
    [0x5021, "LM(1, Ctrl)"],
    [0x5203, "TO(3)"],
    [0x5221, "MO(1)"],
    [0x5242, "DF(2)"],
    [0x5262, "TG(2)"],
    [0x5281, "OSL(1)"],
    [0x52a2, "OSM(Shift)"],
    [0x52c1, "TT(1)"],
    [0x5703, "TD(3)"],
    [0x7700, "M(0)"],
    [0x7c00, "Boot"],
    [0x7e01, "Custom(1)"],
    [0x7400, "0x7400"],
  ])("names 0x%s as %j", (keycode, label) => {
    expect(qmkKeycodeLabel(keycode, "v6")).toBe(label);
  });
});

describe("qmkKeycodeLabel with legacy (v5) keycodes", () => {
  it.each([
    [0x0004, "A"],
    [0x00f4, "Mouse 1"],
    [0x0204, "Shift+A"],
    [0x412c, "LT(1, Space)"],
    [0x5011, "TO(1)"],
    [0x5101, "MO(1)"],
    [0x5302, "TG(2)"],
    [0x5502, "OSM(Shift)"],
    [0x5801, "TT(1)"],
    [0x5912, "LM(1, Shift)"],
    [0x5c00, "Boot"],
    [0x6104, "MT(Ctrl, A)"],
  ])("names 0x%s as %j", (keycode, label) => {
    expect(qmkKeycodeLabel(keycode, "v5")).toBe(label);
  });
});
