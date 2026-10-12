import { describe, expect, it } from "vitest";
import { keyLabel } from "../../src/keyboard/hid-key-names";
import {
  decodeActuationOverrides,
  decodeCurrentProfileIndex,
  decodeKeyMapping,
  decodeProfileMetadata,
  decodeProfileSettings,
  matrixKeyAt,
  wootingTravelToMillimeters,
} from "../../src/protocol/wooting/wooting-profile-codec";
import { WootingProtocolError } from "../../src/protocol/wooting/wooting-codec";
import {
  actuationProfilePayload,
  keyboardProfileContinuousOffPayload,
  keyboardProfilePayload,
  keyboardProfileRapidTriggerOffPayload,
  keyboardProfileSensitivityLoweredPayload,
  keyMappingPayload,
  profileMetadataPayload,
} from "../fakes/wooting-80he-captures";

describe("decodeCurrentProfileIndex", () => {
  it("reads the active profile slot from the first payload byte", () => {
    expect(decodeCurrentProfileIndex(new Uint8Array([0x02, 0x00]))).toBe(2);
  });

  it("rejects an empty payload", () => {
    expect(() => decodeCurrentProfileIndex(new Uint8Array())).toThrow(WootingProtocolError);
  });
});

describe("decodeProfileMetadata", () => {
  it("reads the name, color and icon of the 80HE TenZ profile", () => {
    expect(decodeProfileMetadata(profileMetadataPayload)).toEqual({
      name: "TenZ Profile",
      color: "#ff2828",
      icon: "switchy:gamer",
    });
  });
});

describe("decodeKeyMapping", () => {
  const layout = decodeKeyMapping(keyMappingPayload);
  const labelAt = (row: number, column: number) => keyLabel(matrixKeyAt(layout, (row << 5) | column));

  it.each([
    [0, 0, "Esc"],
    [0, 1, "F1"],
    [1, 14, "Backspace"],
    [2, 1, "Q"],
    [3, 14, "Enter"],
    [4, 0, "Left Shift"],
    [4, 15, "Up"],
    [5, 0, "Left Ctrl"],
    [5, 4, "Space"],
    [5, 16, "Right"],
  ])("names the key at row %i, column %i as %s", (row, column, expected) => {
    expect(labelAt(row, column)).toBe(expected);
  });

  it("leaves unassigned matrix positions out of the layout", () => {
    expect(layout.some((key) => key.matrixRow === 0 && key.matrixColumn === 9)).toBe(false);
  });

  it("falls back to the matrix position for keys without a HID usage", () => {
    expect(labelAt(0, 14)).toBe("Row 0, Col 14");
  });
});

describe("decodeProfileSettings", () => {
  it("reads the TenZ profile with Rapid Trigger and Continuous Rapid Trigger on", () => {
    expect(decodeProfileSettings(keyboardProfilePayload)).toEqual({
      actuationRaw: 0x4fd0,
      rapidTriggerEnabled: true,
      rapidTriggerSensitivityRaw: 0x4686,
      continuousRapidTriggerEnabled: true,
    });
  });

  it("reports Continuous Rapid Trigger off after it was switched off in Wootility", () => {
    expect(decodeProfileSettings(keyboardProfileContinuousOffPayload).continuousRapidTriggerEnabled).toBe(false);
  });

  it("reports Rapid Trigger off after it was switched off in Wootility", () => {
    expect(decodeProfileSettings(keyboardProfileRapidTriggerOffPayload).rapidTriggerEnabled).toBe(false);
  });

  it("reads the lowered Rapid Trigger sensitivity", () => {
    expect(decodeProfileSettings(keyboardProfileSensitivityLoweredPayload).rapidTriggerSensitivityRaw).toBe(0x4333);
  });
});

describe("wootingTravelToMillimeters", () => {
  it.each([
    [0x4fd0, 1.0],
    [0x4686, 0.4],
    [0x4666, 0.4],
    [0x4333, 0.2],
    [0x6fef, 3.0],
  ])("converts raw travel 0x%s to the %s mm Wootility shows", (raw, millimeters) => {
    expect(wootingTravelToMillimeters(raw)).toBe(millimeters);
  });
});

describe("decodeActuationOverrides", () => {
  const overrides = decodeActuationOverrides(actuationProfilePayload);

  it("lists every key with its own actuation point", () => {
    expect(overrides.map((override) => override.matrixPosition)).toEqual([
      0x00, 0x40, 0x42, 0x60, 0x61, 0x62, 0x63, 0xa0, 0xa6,
    ]);
  });

  it("separates the actuation value from the matrix position", () => {
    expect(overrides.slice(0, 3).map((override) => override.actuationRaw)).toEqual([0x6fef, 0x6fef, 0x4686]);
  });
});
