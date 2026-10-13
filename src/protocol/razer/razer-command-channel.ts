import { featureReportByteLength } from "../../hid/collections";
import { dataViewToBytes } from "../../hid/input-report-waiter";
import { describeError } from "../../shared/describe-error";
import {
  decodeRazerReplyArguments,
  describeCommand,
  encodeRazerRequest,
  isRazerReplyPending,
  RazerProtocolError,
} from "./razer-codec";
import { RAZER_CONTROL_REPORT_ID, RAZER_REPORT_LENGTH, type RazerCommand } from "./razer-constants";

const REPLY_POLL_INTERVAL_MS = 8;
const REPLY_POLL_ATTEMPTS = 60;

export class RazerReplyTimeoutError extends RazerProtocolError {
  constructor(command: RazerCommand) {
    super(`The keyboard did not answer command ${describeCommand(command)} in time.`);
    this.name = "RazerReplyTimeoutError";
  }
}

export class RazerCommandChannel {
  private readonly reportLength: number;
  private previousExchange: Promise<unknown> = Promise.resolve();

  constructor(private readonly device: HIDDevice) {
    this.reportLength = featureReportByteLength(device, RAZER_CONTROL_REPORT_ID) || RAZER_REPORT_LENGTH;
  }

  request(command: RazerCommand, commandArguments: readonly number[] = []): Promise<Uint8Array> {
    const result = this.previousExchange.then(() => this.exchange(command, commandArguments));
    this.previousExchange = result.catch(() => undefined);
    return result;
  }

  private async exchange(command: RazerCommand, commandArguments: readonly number[]): Promise<Uint8Array> {
    await this.send(command, commandArguments);
    for (let attempt = 0; attempt < REPLY_POLL_ATTEMPTS; attempt += 1) {
      await delay(REPLY_POLL_INTERVAL_MS);
      const reply = await this.receive(command);
      if (!isRazerReplyPending(reply, command)) return decodeRazerReplyArguments(reply, command);
    }
    throw new RazerReplyTimeoutError(command);
  }

  private async send(command: RazerCommand, commandArguments: readonly number[]): Promise<void> {
    const request = new Uint8Array(this.reportLength);
    request.set(encodeRazerRequest(command, commandArguments));
    try {
      await this.device.sendFeatureReport(RAZER_CONTROL_REPORT_ID, request);
    } catch (error) {
      throw new RazerProtocolError(`Could not send command ${describeCommand(command)}: ${describeError(error)}`);
    }
  }

  private async receive(command: RazerCommand): Promise<Uint8Array> {
    try {
      const reply = dataViewToBytes(await this.device.receiveFeatureReport(RAZER_CONTROL_REPORT_ID));
      return reply.length > this.reportLength ? reply.slice(reply.length - this.reportLength) : reply;
    } catch (error) {
      throw new RazerProtocolError(`Could not read the reply to ${describeCommand(command)}: ${describeError(error)}`);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
