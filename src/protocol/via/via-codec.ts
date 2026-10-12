import { formatHex } from "../../shared/hex";
import { VIA_REPORT_LENGTH, VIA_UNHANDLED_COMMAND, type ViaCommandId } from "./via-constants";

const COMMAND_OFFSET = 0;
const VIAL_PROTOCOL_BYTES = 4;
const VIAL_KEYBOARD_UID_OFFSET = 4;
const VIAL_KEYBOARD_UID_BYTES = 8;
const BYTES_PER_KEYCODE = 2;

export class ViaProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViaProtocolError";
  }
}

export class ViaCommandNotSupportedError extends ViaProtocolError {
  constructor(command: number) {
    super(`The keyboard does not support VIA command ${formatHex(command, 2)}.`);
    this.name = "ViaCommandNotSupportedError";
  }
}

export interface VialKeyboardId {
  readonly protocolVersion: number;
  readonly keyboardUid: string;
}

export function encodeViaRequest(command: ViaCommandId, argumentBytes: readonly number[]): Uint8Array<ArrayBuffer> {
  if (argumentBytes.length >= VIA_REPORT_LENGTH) {
    throw new ViaProtocolError(`A VIA request carries at most ${VIA_REPORT_LENGTH - 1} argument bytes.`);
  }
  const request = new Uint8Array(VIA_REPORT_LENGTH);
  request.set([command, ...argumentBytes]);
  return request;
}

export function isViaReplyTo(report: Uint8Array, command: ViaCommandId): boolean {
  return report[COMMAND_OFFSET] === command || report[COMMAND_OFFSET] === VIA_UNHANDLED_COMMAND;
}

export function viaReplyData(report: Uint8Array, command: ViaCommandId): Uint8Array {
  if (report[COMMAND_OFFSET] === VIA_UNHANDLED_COMMAND) throw new ViaCommandNotSupportedError(command);
  return report.slice(COMMAND_OFFSET + 1);
}

export function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

export function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);
}

export function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

export function decodeVialKeyboardId(report: Uint8Array): VialKeyboardId {
  if (report.length < VIAL_KEYBOARD_UID_OFFSET + VIAL_KEYBOARD_UID_BYTES) {
    throw new ViaProtocolError("The Vial keyboard id reply is too short.");
  }
  const uid = report.slice(VIAL_KEYBOARD_UID_OFFSET, VIAL_KEYBOARD_UID_OFFSET + VIAL_KEYBOARD_UID_BYTES);
  return {
    protocolVersion: readUint32LittleEndian(report, 0),
    keyboardUid: [...uid].reverse().map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

export function isVialKeyboardIdReply(report: Uint8Array): boolean {
  return report.length >= VIAL_PROTOCOL_BYTES && report[COMMAND_OFFSET] !== VIA_UNHANDLED_COMMAND;
}

export function decodeKeycodes(buffer: Uint8Array): number[] {
  const keycodes: number[] = [];
  for (let offset = 0; offset + BYTES_PER_KEYCODE <= buffer.length; offset += BYTES_PER_KEYCODE) {
    keycodes.push(readUint16BigEndian(buffer, offset));
  }
  return keycodes;
}
