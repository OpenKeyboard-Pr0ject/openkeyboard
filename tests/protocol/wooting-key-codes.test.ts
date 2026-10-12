import { describe, expect, it } from "vitest";
import { hidUsageForWootingKeyCode, NO_HID_USAGE } from "../../src/protocol/wooting/wooting-key-codes";

describe("hidUsageForWootingKeyCode", () => {
  it.each([
    [0x01, 0x04, "A"],
    [0x26, 0x29, "Esc"],
    [0x25, 0x28, "Enter"],
    [0x4f, 0x52, "Up"],
    [0x62, 0x65, "Menu"],
    [0x63, 0xe0, "Left Ctrl"],
    [0x64, 0xe1, "Left Shift"],
    [0x6a, 0xe7, "Right Win"],
  ])("maps Wooting code 0x%s to HID usage 0x%s (%s)", (code, usage) => {
    expect(hidUsageForWootingKeyCode(code)).toBe(usage);
  });

  it.each([0x00, 0xe6, 0xf4, 0xff])("reports no HID usage for the special key code 0x%s", (code) => {
    expect(hidUsageForWootingKeyCode(code)).toBe(NO_HID_USAGE);
  });
});
