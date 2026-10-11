export type InputReportMatcher = (reportId: number, report: Uint8Array) => boolean;

export interface PendingInputReport {
  readonly report: Promise<Uint8Array>;
  cancel(reason: Error): void;
}

export class HidReplyTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The device did not reply within ${timeoutMs} ms.`);
    this.name = "HidReplyTimeoutError";
  }
}

export function waitForInputReport(
  device: HIDDevice,
  matches: InputReportMatcher,
  timeoutMs: number,
): PendingInputReport {
  let cancel: (reason: Error) => void = () => undefined;
  const report = new Promise<Uint8Array>((resolve, reject) => {
    const onInputReport = (event: HIDInputReportEvent): void => {
      const bytes = dataViewToBytes(event.data);
      if (!matches(event.reportId, bytes)) return;
      stopWaiting();
      resolve(bytes);
    };
    const stopWaiting = (): void => {
      clearTimeout(timeout);
      device.removeEventListener("inputreport", onInputReport);
    };
    const timeout = setTimeout(() => {
      stopWaiting();
      reject(new HidReplyTimeoutError(timeoutMs));
    }, timeoutMs);
    cancel = (reason) => {
      stopWaiting();
      reject(reason);
    };
    device.addEventListener("inputreport", onInputReport);
  });
  return { report, cancel };
}

export function dataViewToBytes(view: DataView): Uint8Array {
  return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
}
