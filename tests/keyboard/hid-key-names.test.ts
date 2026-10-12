import { describe, expect, it } from "vitest";
import type { AnalogKeyReading } from "../../src/keyboard/analog-keys";
import { keyLabel } from "../../src/keyboard/hid-key-names";

function readingFor(hidUsage: number): AnalogKeyReading {
  return { hidUsage, matrixRow: 4, matrixColumn: 2, depth: 0.5 };
}

describe("keyLabel", () => {
  it.each([
    [0x04, "A"],
    [0x1d, "Z"],
    [0x1e, "1"],
    [0x27, "0"],
    [0x29, "Esc"],
    [0x2c, "Space"],
    [0x39, "Caps Lock"],
    [0x45, "F12"],
    [0x52, "Up"],
    [0x65, "Menu"],
    [0xe1, "Left Shift"],
    [0xe7, "Right Win"],
  ])("names HID usage 0x%s as %s", (usage, expected) => {
    expect(keyLabel(readingFor(usage))).toBe(expected);
  });

  it("falls back to the matrix position for keys without a HID usage", () => {
    expect(keyLabel(readingFor(0x00))).toBe("Row 4, Col 2");
  });
});
