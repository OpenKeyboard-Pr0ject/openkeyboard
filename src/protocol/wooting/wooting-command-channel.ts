import { featureReportByteLength, smallestOutputReportHolding } from "../../hid/collections";
import { waitForInputReport } from "../../hid/input-report-waiter";
import { describeError } from "../../shared/describe-error";
import { formatHex } from "../../shared/hex";
import {
  decodeWootingReplyPayload,
  encodeWootingCommand,
  isWootingReplyTo,
  WootingProtocolError,
} from "./wooting-codec";
import { WOOTING_COMMAND_REPORT_ID, type WootingCommandId } from "./wooting-constants";

const REPLY_TIMEOUT_MS = 1000;

export class WootingCommandChannel {
  private readonly commandReportLength: number;
  private previousExchange: Promise<unknown> = Promise.resolve();

  constructor(private readonly device: HIDDevice) {
    this.commandReportLength = featureReportByteLength(device, WOOTING_COMMAND_REPORT_ID);
  }

  request(command: WootingCommandId, parameters: readonly number[] = []): Promise<Uint8Array> {
    return this.enqueue(() => this.exchange(command, parameters));
  }

  writeReport(report: Uint8Array): Promise<void> {
    return this.enqueue(() => this.sendOutputReport(report));
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.previousExchange.then(operation);
    this.previousExchange = result.catch(() => undefined);
    return result;
  }

  private async sendOutputReport(report: Uint8Array): Promise<void> {
    const outputReport = smallestOutputReportHolding(this.device, report.length);
    const padded = new Uint8Array(outputReport.byteLength);
    padded.set(report);
    try {
      await this.device.sendReport(outputReport.reportId, padded);
    } catch (error) {
      throw new WootingProtocolError(`Could not write report ${formatHex(report[2], 2)}: ${describeError(error)}`);
    }
  }

  private async exchange(command: WootingCommandId, parameters: readonly number[]): Promise<Uint8Array> {
    const pendingReply = waitForInputReport(
      this.device,
      (_reportId, report) => isWootingReplyTo(report, command),
      REPLY_TIMEOUT_MS,
    );
    try {
      await this.device.sendFeatureReport(
        WOOTING_COMMAND_REPORT_ID,
        encodeWootingCommand(command, parameters, this.commandReportLength),
      );
    } catch (error) {
      const reason = `Could not send command ${formatHex(command, 2)}: ${describeError(error)}`;
      pendingReply.cancel(new WootingProtocolError(reason));
    }
    return decodeWootingReplyPayload(await pendingReply.report);
  }
}
