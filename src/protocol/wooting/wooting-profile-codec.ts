import type { MatrixKey } from "../../keyboard/matrix-key";
import { ProtobufMessage } from "../protobuf/protobuf-message";
import { WootingProtocolError } from "./wooting-codec";
import { hidUsageForWootingKeyCode, NO_HID_USAGE, UNASSIGNED_KEY_CODE } from "./wooting-key-codes";
import { matrixColumnOf, matrixRowOf } from "./wooting-matrix";

const PRECISE_TRAVEL_FLAG = 0x4000;
const PRECISE_TRAVEL_MAX_RAW = 0x3fff;
const PRECISE_ENTRY_POSITION_RANGE = 0x10000;
const LEGACY_TRAVEL_MAX_RAW = 0xff;
const FULL_TRAVEL_MILLIMETERS = 4.0;
const LEGACY_ENTRY_POSITION_RANGE = 0x100;
const TRAVEL_STEPS_PER_MILLIMETER = 20;
const ENABLED = 1;
const DISABLED = 0;

const MetadataField = { name: 1, color: 2, icon: 3 } as const;
const ColorField = { red: 1, green: 2, blue: 3 } as const;
const MappingField = { row: 1, keyCodes: 1 } as const;
const ActuationField = { legacyPerKey: 2, precisePerKey: 4, entries: 1 } as const;
const KeyboardProfileField = { settings: 1 } as const;
const ProfileSettingsField = {
  actuation: 1,
  rapidTriggerEnabled: 3,
  rapidTriggerSensitivity: 4,
  continuousRapidTriggerDisabled: 7,
} as const;

export interface WootingProfileSettings {
  readonly actuationRaw: number;
  readonly rapidTriggerEnabled: boolean;
  readonly rapidTriggerSensitivityRaw: number;
  readonly continuousRapidTriggerEnabled: boolean;
}

export type WootingProfileSettingsChange = Partial<WootingProfileSettings>;

export interface WootingProfileMetadata {
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

export interface WootingKeyActuation {
  readonly matrixPosition: number;
  readonly actuationRaw: number;
}

export function decodeCurrentProfileIndex(payload: Uint8Array): number {
  if (payload.length === 0) throw new WootingProtocolError("The current profile reply is empty.");
  return payload[0];
}

export function decodeProfileMetadata(payload: Uint8Array): WootingProfileMetadata {
  const metadata = ProtobufMessage.decode(payload);
  const color = metadata.message(MetadataField.color);
  return {
    name: metadata.string(MetadataField.name),
    color: rgbHex(color.varint(ColorField.red), color.varint(ColorField.green), color.varint(ColorField.blue)),
    icon: metadata.string(MetadataField.icon),
  };
}

export function decodeKeyMapping(payload: Uint8Array): MatrixKey[] {
  return ProtobufMessage.decode(payload)
    .repeatedMessages(MappingField.row)
    .flatMap((row, matrixRow) => decodeMappingRow(row.bytes(MappingField.keyCodes), matrixRow));
}

export function decodeActuationOverrides(payload: Uint8Array): WootingKeyActuation[] {
  const actuationProfile = ProtobufMessage.decode(payload);
  return [
    ...unpackKeyActuations(actuationProfile.message(ActuationField.precisePerKey), PRECISE_ENTRY_POSITION_RANGE),
    ...unpackKeyActuations(actuationProfile.message(ActuationField.legacyPerKey), LEGACY_ENTRY_POSITION_RANGE),
  ];
}

function unpackKeyActuations(perKey: ProtobufMessage, positionRange: number): WootingKeyActuation[] {
  return perKey.repeatedVarints(ActuationField.entries).map((entry) => ({
    matrixPosition: entry % positionRange,
    actuationRaw: Math.floor(entry / positionRange),
  }));
}

export function decodeProfileSettings(payload: Uint8Array): WootingProfileSettings {
  const settings = ProtobufMessage.decode(payload).message(KeyboardProfileField.settings);
  return {
    actuationRaw: settings.varint(ProfileSettingsField.actuation),
    rapidTriggerEnabled: settings.varint(ProfileSettingsField.rapidTriggerEnabled) !== 0,
    rapidTriggerSensitivityRaw: settings.varint(ProfileSettingsField.rapidTriggerSensitivity),
    continuousRapidTriggerEnabled: settings.varint(ProfileSettingsField.continuousRapidTriggerDisabled) === 0,
  };
}

export function applyProfileSettingsChange(payload: Uint8Array, change: WootingProfileSettingsChange): Uint8Array<ArrayBuffer> {
  const profile = ProtobufMessage.decode(payload);
  const updatedSettings = settingsFieldUpdates(change).reduce(
    (settings, [fieldNumber, value]) => settings.withVarint(fieldNumber, value),
    profile.message(KeyboardProfileField.settings),
  );
  return profile.withMessage(KeyboardProfileField.settings, updatedSettings).encode();
}

function settingsFieldUpdates(change: WootingProfileSettingsChange): Array<readonly [number, number]> {
  const updates: Array<readonly [number, number]> = [];
  if (change.actuationRaw !== undefined) updates.push([ProfileSettingsField.actuation, change.actuationRaw]);
  if (change.rapidTriggerEnabled !== undefined) {
    updates.push([ProfileSettingsField.rapidTriggerEnabled, change.rapidTriggerEnabled ? ENABLED : DISABLED]);
  }
  if (change.rapidTriggerSensitivityRaw !== undefined) {
    updates.push([ProfileSettingsField.rapidTriggerSensitivity, change.rapidTriggerSensitivityRaw]);
  }
  if (change.continuousRapidTriggerEnabled !== undefined) {
    updates.push([ProfileSettingsField.continuousRapidTriggerDisabled, change.continuousRapidTriggerEnabled ? DISABLED : ENABLED]);
  }
  return updates;
}

export function millimetersToPreciseTravel(millimeters: number): number {
  return PRECISE_TRAVEL_FLAG + Math.round((millimeters / FULL_TRAVEL_MILLIMETERS) * PRECISE_TRAVEL_MAX_RAW);
}

export function wootingTravelToMillimeters(raw: number): number {
  const millimeters = raw >= PRECISE_TRAVEL_FLAG
    ? ((raw - PRECISE_TRAVEL_FLAG) / PRECISE_TRAVEL_MAX_RAW) * FULL_TRAVEL_MILLIMETERS
    : (raw / LEGACY_TRAVEL_MAX_RAW) * FULL_TRAVEL_MILLIMETERS;
  return Math.round(millimeters * TRAVEL_STEPS_PER_MILLIMETER) / TRAVEL_STEPS_PER_MILLIMETER;
}

export function matrixKeyAt(layout: readonly MatrixKey[], matrixPosition: number): MatrixKey {
  const row = matrixRowOf(matrixPosition);
  const column = matrixColumnOf(matrixPosition);
  const mapped = layout.find((key) => key.matrixRow === row && key.matrixColumn === column);
  return mapped ?? { hidUsage: NO_HID_USAGE, matrixRow: row, matrixColumn: column };
}

function decodeMappingRow(keyCodes: Uint8Array, matrixRow: number): MatrixKey[] {
  return [...keyCodes]
    .map((code, matrixColumn) => ({ code, matrixColumn }))
    .filter(({ code }) => code !== UNASSIGNED_KEY_CODE)
    .map(({ code, matrixColumn }) => ({ hidUsage: hidUsageForWootingKeyCode(code), matrixRow, matrixColumn }));
}

function rgbHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
