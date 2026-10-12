import { waitForInputReport, type InputReportMatcher } from "../../hid/input-report-waiter";
import { describeError } from "../../shared/describe-error";
import { formatHex } from "../../shared/hex";
import { encodeViaRequest, isViaReplyTo, viaReplyData, ViaProtocolError } from "./via-codec";
import { VIA_REPORT_ID, ViaCommand, type ViaCommandId } from "./via-constants";

const REPLY_TIMEOUT_MS = 1000;

export class ViaCommandChannel {
  private previousExchange: Promise<unknown> = Promise.resolve();

  constructor(private readonly device: HIDDevice) {}

  request(command: ViaCommandId, argumentBytes: readonly number[] = []): Promise<Uint8Array> {
    const matchesReply: InputReportMatcher = (_reportId, report) => isViaReplyTo(report, command);
    return this.enqueue(async () => viaReplyData(await this.exchange(command, argumentBytes, matchesReply), command));
  }

  requestVial(vialCommand: number, argumentBytes: readonly number[] = []): Promise<Uint8Array> {
    const matchesAnyReport: InputReportMatcher = () => true;
    return this.enqueue(() => this.exchange(ViaCommand.vialPrefix, [vialCommand, ...argumentBytes], matchesAnyReport));
  }

  private enqueue(exchange: () => Promise<Uint8Array>): Promise<Uint8Array> {
    const result = this.previousExchange.then(exchange);
    this.previousExchange = result.catch(() => undefined);
    return result;
  }

  private async exchange(
    command: ViaCommandId,
    argumentBytes: readonly number[],
    matchesReply: InputReportMatcher,
  ): Promise<Uint8Array> {
    const pendingReply = waitForInputReport(this.device, matchesReply, REPLY_TIMEOUT_MS);
    try {
      await this.device.sendReport(VIA_REPORT_ID, encodeViaRequest(command, argumentBytes));
    } catch (error) {
      const reason = `Could not send VIA command ${formatHex(command, 2)}: ${describeError(error)}`;
      pendingReply.cancel(new ViaProtocolError(reason));
    }
    return pendingReply.report;
  }
}
