import type { MatrixKey } from "../../keyboard/matrix-key";
import { ProtobufMessage } from "../protobuf/protobuf-message";
import { WootingProtocolError } from "./wooting-codec";
import { hidUsageForWootingKeyCode, NO_HID_USAGE, UNASSIGNED_KEY_CODE } from "./wooting-key-codes";
import { matrixColumnOf, matrixRowOf } from "./wooting-matrix";

const PACKED_POSITION_RANGE = 0x10000;

const MetadataField = { name: 1, color: 2, icon: 3 } as const;
const ColorField = { red: 1, green: 2, blue: 3 } as const;
const MappingField = { row: 1, keyCodes: 1 } as const;
const ActuationField = { perKey: 4, packedEntries: 1 } as const;

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
  const entries = ProtobufMessage.decode(payload).message(ActuationField.perKey).packedVarints(ActuationField.packedEntries);
  return entries.map((entry) => ({
    matrixPosition: entry % PACKED_POSITION_RANGE,
    actuationRaw: Math.floor(entry / PACKED_POSITION_RANGE),
  }));
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
