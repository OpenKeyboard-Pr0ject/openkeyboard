import { featureReportByteLength } from "../../hid/collections";
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

  request(command: WootingCommandId): Promise<Uint8Array> {
    const exchange = this.previousExchange.then(() => this.exchange(command));
    this.previousExchange = exchange.catch(() => undefined);
    return exchange;
  }

  private async exchange(command: WootingCommandId): Promise<Uint8Array> {
    const pendingReply = waitForInputReport(
      this.device,
      (_reportId, report) => isWootingReplyTo(report, command),
      REPLY_TIMEOUT_MS,
    );
    try {
      await this.device.sendFeatureReport(
        WOOTING_COMMAND_REPORT_ID,
        encodeWootingCommand(command, this.commandReportLength),
      );
    } catch (error) {
      const reason = `Could not send command ${formatHex(command, 2)}: ${describeError(error)}`;
      pendingReply.cancel(new WootingProtocolError(reason));
    }
    return decodeWootingReplyPayload(await pendingReply.report);
  }
}
