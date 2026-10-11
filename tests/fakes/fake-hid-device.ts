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
  readonly failFeatureReports?: boolean;
}

const COMMAND_REPORT_ID = 1;
const COMMAND_REPORT_BYTES = 7;

export const wootingConfigCollection: HIDCollectionInfo = {
  usagePage: WOOTING_CONFIG_USAGE_PAGE,
  usage: WOOTING_CONFIG_USAGE,
  children: [],
  inputReports: [],
  outputReports: [],
  featureReports: [{ reportId: COMMAND_REPORT_ID, items: [{ reportSize: 8, reportCount: COMMAND_REPORT_BYTES }] }],
};

export class FakeHidDevice {
  opened = false;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  readonly sentFeatureReports: Array<{ reportId: number; data: Uint8Array }> = [];
  private readonly inputListeners = new Set<InputReportListener>();

  constructor(private readonly options: FakeHidDeviceOptions = {}) {
    this.vendorId = options.vendorId ?? WOOTING_VENDOR_ID;
    this.productId = options.productId ?? WOOTING_80HE_PRODUCT_ID;
    this.productName = options.productName ?? WOOTING_80HE_PRODUCT_NAME;
    this.collections = options.collections ?? [wootingConfigCollection];
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async forget(): Promise<void> {
    this.opened = false;
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
