import {
  WOOTING_CONFIG_USAGE,
  WOOTING_CONFIG_USAGE_PAGE,
  WOOTING_VENDOR_ID,
} from "../../src/protocol/wooting/wooting-constants";
import { WOOTING_80HE_PRODUCT_ID, WOOTING_80HE_PRODUCT_NAME } from "./wooting-80he-captures";

type InputReportListener = (event: HIDInputReportEvent) => void;
export type FeatureReportResponder = (reportId: number, data: Uint8Array) => Uint8Array | undefined;

export interface FakeHidDeviceOptions {
  readonly vendorId?: number;
  readonly productId?: number;
  readonly productName?: string;
  readonly collections?: HIDCollectionInfo[];
  readonly respond?: FeatureReportResponder;
  readonly receiveOutputReport?: (reportId: number, data: Uint8Array) => void;
  readonly failFeatureReports?: boolean;
}

const COMMAND_REPORT_ID = 1;
const COMMAND_REPORT_BYTES = 7;
const STATE_CHANGE_IN_PROGRESS = "An operation that changes the device state is in progress.";

function byteReport(reportId: number, byteCount: number): HIDReportInfo {
  return { reportId, items: [{ reportSize: 8, reportCount: byteCount }] };
}

export const wootingConfigCollection: HIDCollectionInfo = {
  usagePage: WOOTING_CONFIG_USAGE_PAGE,
  usage: WOOTING_CONFIG_USAGE,
  children: [],
  inputReports: [],
  outputReports: [byteReport(3, 254), byteReport(1, 32), byteReport(2, 62)],
  featureReports: [byteReport(COMMAND_REPORT_ID, COMMAND_REPORT_BYTES)],
};

export const wootingAnalogCollection: HIDCollectionInfo = {
  usagePage: 0xff53,
  usage: 0x01,
  children: [],
  inputReports: [],
  outputReports: [],
  featureReports: [],
};

export class FakeHidDevice {
  opened = false;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  readonly sentFeatureReports: Array<{ reportId: number; data: Uint8Array }> = [];
  readonly sentOutputReports: Array<{ reportId: number; data: Uint8Array }> = [];
  private readonly inputListeners = new Set<InputReportListener>();
  private stateChangeInProgress = false;

  constructor(private readonly options: FakeHidDeviceOptions = {}) {
    this.vendorId = options.vendorId ?? WOOTING_VENDOR_ID;
    this.productId = options.productId ?? WOOTING_80HE_PRODUCT_ID;
    this.productName = options.productName ?? WOOTING_80HE_PRODUCT_NAME;
    this.collections = options.collections ?? [wootingConfigCollection];
  }

  async open(): Promise<void> {
    await this.changeOpenState(true);
  }

  async close(): Promise<void> {
    await this.changeOpenState(false);
  }

  private async changeOpenState(opened: boolean): Promise<void> {
    if (this.stateChangeInProgress) throw new DOMException(STATE_CHANGE_IN_PROGRESS, "InvalidStateError");
    if (this.opened === opened) return;
    this.stateChangeInProgress = true;
    await Promise.resolve();
    this.opened = opened;
    this.stateChangeInProgress = false;
  }

  async forget(): Promise<void> {
    this.opened = false;
  }

  async sendReport(reportId: number, data: BufferSource): Promise<void> {
    const bytes = toBytes(data);
    this.sentOutputReports.push({ reportId, data: bytes });
    this.options.receiveOutputReport?.(reportId, bytes);
  }

  async sendFeatureReport(reportId: number, data: BufferSource): Promise<void> {
    if (this.options.failFeatureReports) throw new Error("Failed to write the feature report.");
    const bytes = toBytes(data);
    this.sentFeatureReports.push({ reportId, data: bytes });
    const reply = this.options.respond?.(reportId, bytes);
    if (reply) queueMicrotask(() => this.emitInputReport(COMMAND_REPORT_ID, reply));
  }

  addEventListener(_type: "inputreport", listener: InputReportListener): void {
    this.inputListeners.add(listener);
  }

  removeEventListener(_type: "inputreport", listener: InputReportListener): void {
    this.inputListeners.delete(listener);
  }

  emitInputReport(reportId: number, data: Uint8Array): void {
    const event = { reportId, data: new DataView(data.slice().buffer), device: this } as unknown as HIDInputReportEvent;
    [...this.inputListeners].forEach((listener) => listener(event));
  }

  listenerCount(): number {
    return this.inputListeners.size;
  }

  asHidDevice(): HIDDevice {
    return this as unknown as HIDDevice;
  }
}

function toBytes(data: BufferSource): Uint8Array {
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  return new Uint8Array(data).slice();
}
