import { formatHex } from "../../shared/hex";
import {
  RAZER_REPORT_LENGTH,
  RAZER_TRANSACTION_ID,
  type RazerCommand,
  RazerStatus,
} from "./razer-constants";

const STATUS_OFFSET = 0;
const TRANSACTION_ID_OFFSET = 1;
const DATA_SIZE_OFFSET = 5;
const COMMAND_CLASS_OFFSET = 6;
const COMMAND_ID_OFFSET = 7;
const ARGUMENTS_OFFSET = 8;
const ARGUMENTS_CAPACITY = 80;
const CHECKSUM_OFFSET = 88;
const CHECKSUM_START_OFFSET = 2;

const FIRMWARE_VERSION_BYTES = 2;

export class RazerProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazerProtocolError";
  }
}

export class RazerCommandRejectedError extends RazerProtocolError {
  constructor(command: RazerCommand, status: number) {
    super(`The keyboard rejected command ${describeCommand(command)} with status ${formatHex(status, 2)}.`);
    this.name = "RazerCommandRejectedError";
  }
}

export class RazerCommandNotSupportedError extends RazerProtocolError {
  constructor(command: RazerCommand) {
    super(`The keyboard does not support command ${describeCommand(command)}.`);
    this.name = "RazerCommandNotSupportedError";
  }
}

export class RazerKeyboardNotRespondingError extends RazerProtocolError {
  constructor() {
    super(
      "The receiver could not reach the keyboard. "
      + "Turn the keyboard on and switch it to HyperSpeed wireless mode, or connect it with the cable.",
    );
    this.name = "RazerKeyboardNotRespondingError";
  }
}

export function encodeRazerRequest(
  command: RazerCommand,
  commandArguments: readonly number[] = [],
): Uint8Array<ArrayBuffer> {
  if (commandArguments.length > ARGUMENTS_CAPACITY) {
    throw new RazerProtocolError(`A command carries at most ${ARGUMENTS_CAPACITY} argument bytes.`);
  }
  const report = new Uint8Array(RAZER_REPORT_LENGTH);
  report[TRANSACTION_ID_OFFSET] = RAZER_TRANSACTION_ID;
  report[DATA_SIZE_OFFSET] = Math.max(command.dataSize, commandArguments.length);
  report[COMMAND_CLASS_OFFSET] = command.commandClass;
  report[COMMAND_ID_OFFSET] = command.commandId;
  report.set(commandArguments, ARGUMENTS_OFFSET);
  report[CHECKSUM_OFFSET] = checksumOf(report);
  return report;
}

export function isRazerReplyPending(reply: Uint8Array, command: RazerCommand): boolean {
  if (reply.length < RAZER_REPORT_LENGTH) return true;
  const status = reply[STATUS_OFFSET];
  return status === RazerStatus.new || status === RazerStatus.busy || !answersCommand(reply, command);
}

export function decodeRazerReplyArguments(reply: Uint8Array, command: RazerCommand): Uint8Array {
  if (reply.length < RAZER_REPORT_LENGTH) {
    throw new RazerProtocolError(`The reply carries ${reply.length} bytes instead of ${RAZER_REPORT_LENGTH}.`);
  }
  if (!answersCommand(reply, command)) {
    throw new RazerProtocolError(`The reply does not answer command ${describeCommand(command)}.`);
  }
  if (reply[CHECKSUM_OFFSET] !== checksumOf(reply)) {
    throw new RazerProtocolError(`The reply to command ${describeCommand(command)} has a wrong checksum.`);
  }
  assertSuccessStatus(reply[STATUS_OFFSET], command);
  const dataSize = Math.min(reply[DATA_SIZE_OFFSET], ARGUMENTS_CAPACITY);
  return reply.slice(ARGUMENTS_OFFSET, ARGUMENTS_OFFSET + dataSize);
}

export function decodeRazerFirmwareVersion(replyArguments: Uint8Array): string {
  if (replyArguments.length < FIRMWARE_VERSION_BYTES) {
    throw new RazerProtocolError(`The firmware version reply carries only ${replyArguments.length} bytes.`);
  }
  const [major, minor] = replyArguments;
  return `${major}.${minor}`;
}

export function describeCommand(command: RazerCommand): string {
  return `${formatHex(command.commandClass, 2)}:${formatHex(command.commandId, 2)}`;
}

function answersCommand(reply: Uint8Array, command: RazerCommand): boolean {
  return reply[TRANSACTION_ID_OFFSET] === RAZER_TRANSACTION_ID
    && reply[COMMAND_CLASS_OFFSET] === command.commandClass
    && reply[COMMAND_ID_OFFSET] === command.commandId;
}

function assertSuccessStatus(status: number, command: RazerCommand): void {
  if (status === RazerStatus.success) return;
  if (status === RazerStatus.notSupported) throw new RazerCommandNotSupportedError(command);
  if (status === RazerStatus.noResponse) throw new RazerKeyboardNotRespondingError();
  throw new RazerCommandRejectedError(command, status);
}

function checksumOf(report: Uint8Array): number {
  let checksum = 0;
  for (let offset = CHECKSUM_START_OFFSET; offset < CHECKSUM_OFFSET; offset += 1) checksum ^= report[offset];
  return checksum;
}
