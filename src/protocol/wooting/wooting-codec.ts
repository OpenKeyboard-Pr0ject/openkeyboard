import { formatHex } from "../../shared/hex";
import { WOOTING_PROFILE_SLOT_COUNT, type WootingCommandId, type WootingReportTypeId } from "./wooting-constants";

const COMMAND_MAGIC = [0xd1, 0xda] as const;
const COMMAND_PARAMETER_BYTES = 4;
const MINIMUM_COMMAND_LENGTH = COMMAND_MAGIC.length + 1 + COMMAND_PARAMETER_BYTES;

const REPLY_COMMAND_OFFSET = 2;
const REPLY_STATUS_OFFSET = 3;
const REPLY_PAYLOAD_LENGTH_OFFSET = 4;
const REPLY_PAYLOAD_OFFSET = 6;
const REPLY_SUCCESS_STATUS = 0x88;

const FIRMWARE_VERSION_BYTES = 3;
const REPORT_LENGTH_BYTES = 2;
const STORAGE_SAVE_BIT = 0x01;
const STORAGE_SLOT_SHIFT = 1;

export class WootingProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WootingProtocolError";
  }
}

export function encodeWootingCommand(
  command: WootingCommandId,
  parameters: readonly number[],
  reportLength: number,
): Uint8Array<ArrayBuffer> {
  if (parameters.length > COMMAND_PARAMETER_BYTES) {
    throw new WootingProtocolError(`A command carries at most ${COMMAND_PARAMETER_BYTES} parameter bytes.`);
  }
  const report = new Uint8Array(Math.max(reportLength, MINIMUM_COMMAND_LENGTH));
  report.set([...COMMAND_MAGIC, command, ...parameters]);
  return report;
}

export function storageForSavingToSlot(slot: number): number {
  if (!Number.isInteger(slot) || slot < 0 || slot >= WOOTING_PROFILE_SLOT_COUNT) {
    throw new WootingProtocolError(`Profile slot ${slot} does not exist.`);
  }
  return (slot << STORAGE_SLOT_SHIFT) | STORAGE_SAVE_BIT;
}

export function encodeWootingReport(
  reportType: WootingReportTypeId,
  storage: number,
  payload?: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const header = [...COMMAND_MAGIC, reportType, storage];
  if (!payload) return Uint8Array.from(header);
  const report = new Uint8Array(header.length + REPORT_LENGTH_BYTES + payload.length);
  report.set([...header, payload.length & 0xff, payload.length >> 8]);
  report.set(payload, header.length + REPORT_LENGTH_BYTES);
  return report;
}

export function isWootingReplyTo(report: Uint8Array, command: WootingCommandId): boolean {
  return hasCommandMagic(report) && report[REPLY_COMMAND_OFFSET] === command;
}

export function decodeWootingReplyPayload(report: Uint8Array): Uint8Array {
  if (!hasCommandMagic(report)) {
    throw new WootingProtocolError("The reply does not start with the Wooting command magic.");
  }
  assertSuccessStatus(report);
  const payloadEnd = REPLY_PAYLOAD_OFFSET + readPayloadLength(report);
  if (payloadEnd > report.length) {
    throw new WootingProtocolError("The reply declares a longer payload than it carries.");
  }
  return report.slice(REPLY_PAYLOAD_OFFSET, payloadEnd);
}

export function decodeFirmwareVersion(payload: Uint8Array): string {
  if (payload.length < FIRMWARE_VERSION_BYTES) {
    throw new WootingProtocolError(`The firmware version reply carries only ${payload.length} bytes.`);
  }
  const [major, minor, patch] = payload;
  return `${major}.${minor}.${patch}`;
}

function hasCommandMagic(report: Uint8Array): boolean {
  return report.length >= REPLY_PAYLOAD_OFFSET && report[0] === COMMAND_MAGIC[0] && report[1] === COMMAND_MAGIC[1];
}

function assertSuccessStatus(report: Uint8Array): void {
  const status = report[REPLY_STATUS_OFFSET];
  if (status === REPLY_SUCCESS_STATUS) return;
  const command = formatHex(report[REPLY_COMMAND_OFFSET], 2);
  throw new WootingProtocolError(`The keyboard rejected command ${command} with status ${formatHex(status, 2)}.`);
}

function readPayloadLength(report: Uint8Array): number {
  return new DataView(report.buffer, report.byteOffset, report.byteLength).getUint16(REPLY_PAYLOAD_LENGTH_OFFSET, true);
}
