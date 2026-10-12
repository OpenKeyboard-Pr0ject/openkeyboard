import { describe, expect, it } from "vitest";
import { ProtobufMessage } from "../../src/protocol/protobuf/protobuf-message";
import { encodeWootingReport, storageForSavingToSlot, WootingProtocolError } from "../../src/protocol/wooting/wooting-codec";
import { WootingReportType } from "../../src/protocol/wooting/wooting-constants";
import {
  applyProfileSettingsChange,
  decodeProfileSettings,
  millimetersToPreciseTravel,
} from "../../src/protocol/wooting/wooting-profile-codec";
import {
  actuationProfilePayload,
  keyboardProfileCurrentPayload,
  keyMappingPayload,
  payloadOf,
  profileMetadataPayload,
  ultraProfileActuationPayload,
  typingProfileSettingsPayload,
  ultraProfileSettingsPayload,
  wootilitySensitivityHalfMillimeterPayload,
  wootilitySensitivityHalfMillimeterReport,
} from "../fakes/wooting-80he-captures";

describe("ProtobufMessage.encode", () => {
  it.each([
    ["keyboard profile", keyboardProfileCurrentPayload],
    ["legacy keyboard profile", ultraProfileSettingsPayload],
    ["profile metadata", profileMetadataPayload],
    ["key mapping", keyMappingPayload],
    ["actuation profile", actuationProfilePayload],
    ["legacy actuation profile", ultraProfileActuationPayload],
  ])("reproduces the captured %s byte for byte", (_name, payload) => {
    expect(ProtobufMessage.decode(payload).encode()).toEqual(payload);
  });

  it("replaces a varint field in place", () => {
    const message = ProtobufMessage.decode(payloadOf("08011002")).withVarint(1, 300);

    expect(message.encode()).toEqual(payloadOf("08ac021002"));
  });

  it("inserts a missing field in field-number order", () => {
    const message = ProtobufMessage.decode(payloadOf("08011803")).withVarint(2, 2);

    expect(message.encode()).toEqual(payloadOf("080110021803"));
  });
});

describe("millimetersToPreciseTravel", () => {
  it.each([
    [0.2, 0x4333],
    [0.4, 0x4666],
    [0.5, 0x4800],
    [1.0, 0x5000],
    [2.95, 0x6f32],
    [3.0, 0x6fff],
    [4.0, 0x7fff],
  ])("encodes %s mm exactly like Wootility (0x%s)", (millimeters, raw) => {
    expect(millimetersToPreciseTravel(millimeters)).toBe(raw);
  });
});

describe("applyProfileSettingsChange", () => {
  it("produces exactly the payload Wootility wrote for a 0.5 mm sensitivity", () => {
    const updated = applyProfileSettingsChange(keyboardProfileCurrentPayload, { rapidTriggerSensitivityRaw: 0x4800 });

    expect(updated).toEqual(wootilitySensitivityHalfMillimeterPayload);
  });

  it("writes Continuous Rapid Trigger as the inverted field Wootility uses", () => {
    const updated = applyProfileSettingsChange(keyboardProfileCurrentPayload, { continuousRapidTriggerEnabled: false });

    expect(decodeProfileSettings(updated).continuousRapidTriggerEnabled).toBe(false);
  });

  it("leaves every field it was not asked to change untouched", () => {
    const updated = applyProfileSettingsChange(keyboardProfileCurrentPayload, { rapidTriggerEnabled: false });
    const before = ProtobufMessage.decode(keyboardProfileCurrentPayload).message(1);
    const after = ProtobufMessage.decode(updated).message(1);

    expect([2, 4, 5, 6, 7, 9].map((field) => after.varint(field))).toEqual([2, 4, 5, 6, 7, 9].map((field) => before.varint(field)));
  });

  it("makes no change when nothing is requested", () => {
    expect(applyProfileSettingsChange(keyboardProfileCurrentPayload, {})).toEqual(keyboardProfileCurrentPayload);
  });
});

describe("encodeWootingReport", () => {
  it("frames the settings payload exactly as the report written to the 80HE", () => {
    const report = encodeWootingReport(
      WootingReportType.keyboardProfileSettings,
      storageForSavingToSlot(0),
      wootilitySensitivityHalfMillimeterPayload,
    );

    expect(report).toEqual(wootilitySensitivityHalfMillimeterReport);
  });

  it("frames a report without payload as magic, type and storage only", () => {
    const report = encodeWootingReport(WootingReportType.settingsUpdateMarker, storageForSavingToSlot(0));

    expect(report).toEqual(payloadOf("d1da1d01"));
  });
});

describe("storageForSavingToSlot", () => {
  it.each([
    [0, 0x01],
    [1, 0x03],
    [2, 0x05],
    [3, 0x07],
  ])("marks slot %i as 0x%s, the byte Wootility sends when it saves that slot", (slot, storage) => {
    expect(storageForSavingToSlot(slot)).toBe(storage);
  });

  it.each([-1, 4, 1.5])("rejects slot %s", (slot) => {
    expect(() => storageForSavingToSlot(slot)).toThrow(WootingProtocolError);
  });
});

describe("Saving the Typing Profile in slot 1", () => {
  it("produces exactly the report Wootility sent for a 2.95 mm actuation point", () => {
    const payload = applyProfileSettingsChange(typingProfileSettingsPayload, {
      actuationRaw: millimetersToPreciseTravel(2.95),
    });

    const report = encodeWootingReport(WootingReportType.keyboardProfileSettings, storageForSavingToSlot(1), payload);

    expect(report).toEqual(payloadOf("d1da110316000a1408b2de011001180020e68c012800300238014800"));
  });

  it("restores the original bytes when set back to 3.00 mm", () => {
    const edited = payloadOf("0a1408b2de011001180020e68c012800300238014800");

    const restored = applyProfileSettingsChange(edited, { actuationRaw: millimetersToPreciseTravel(3.0) });

    expect(restored).toEqual(typingProfileSettingsPayload);
  });
});
