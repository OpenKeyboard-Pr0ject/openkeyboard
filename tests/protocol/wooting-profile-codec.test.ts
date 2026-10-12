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
  payloadOf,
  profileMetadataPayload,
  ultraProfileActuationPayload,
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
    [0x6fff, 3.0],
  ])("converts precise raw travel 0x%s to %s mm", (raw, millimeters) => {
    expect(wootingTravelToMillimeters(raw)).toBe(millimeters);
  });

  it.each([
    [0x1a, 0.4],
    [0x3f, 1.0],
    [0xbf, 3.0],
    [0xff, 4.0],
  ])("converts legacy 8-bit raw travel 0x%s to %s mm", (raw, millimeters) => {
    expect(wootingTravelToMillimeters(raw)).toBe(millimeters);
  });
});

describe("decodeActuationOverrides with the unpacked list Wootility writes", () => {
  const wootilityWritePayload = payloadOf(
    "2236088080bcff0608c080bcff0608c28098b40408e080bcff0608e18098b40408e28098b40408e38098b40408a08198b40408a681bcff06",
  );

  it("reads the same keys as the packed list the keyboard returns", () => {
    expect(decodeActuationOverrides(wootilityWritePayload)).toEqual(decodeActuationOverrides(actuationProfilePayload));
  });
});

describe("decodeActuationOverrides with the legacy 8-bit layout", () => {
  const overrides = decodeActuationOverrides(ultraProfileActuationPayload);

  it("separates the 8-bit actuation value from the matrix position", () => {
    expect(overrides.slice(0, 2)).toEqual([
      { matrixPosition: 0x42, actuationRaw: 0x1a },
      { matrixPosition: 0x61, actuationRaw: 0x1a },
    ]);
  });

  it("lists every key of the TenZ Ultra profile", () => {
    expect(overrides.map((override) => override.matrixPosition)).toEqual([
      0x42, 0x61, 0x62, 0x63, 0xa0, 0x00, 0x40, 0x60, 0xa6,
    ]);
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
