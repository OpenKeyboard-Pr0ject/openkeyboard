import {
  RAZER_CONTROL_USAGE,
  RAZER_CONTROL_USAGE_PAGE,
  RAZER_VENDOR_ID,
  RazerStatus,
} from "../../src/protocol/razer/razer-constants";
import {
  BLACKWIDOW_V3_MINI_PRODUCT_NAME,
  BLACKWIDOW_V3_MINI_WIRED_PRODUCT_ID,
} from "./razer-blackwidow-v3-mini-captures";

const REPORT_LENGTH = 90;
const DATA_SIZE_OFFSET = 5;
const COMMAND_CLASS_OFFSET = 6;
const COMMAND_ID_OFFSET = 7;
const ARGUMENTS_OFFSET = 8;
const CHECKSUM_OFFSET = 88;

export const razerControlCollection: HIDCollectionInfo = {
  usagePage: RAZER_CONTROL_USAGE_PAGE,
  usage: RAZER_CONTROL_USAGE,
  children: [],
  inputReports: [],
  outputReports: [],
  featureReports: [{ reportId: 0, items: [{ reportSize: 8, reportCount: REPORT_LENGTH }] }],
};

export const razerConsumerKeysCollection: HIDCollectionInfo = { ...razerControlCollection, featureReports: [] };

export interface FakeRazerKeyboardOptions {
  readonly productId?: number;
  readonly collections?: HIDCollectionInfo[];
  readonly busyPollsPerRequest?: number;
  readonly ignoresWrites?: boolean;
  readonly keyboardUnreachable?: boolean;
  readonly repliesWithReportIdPrefix?: boolean;
  readonly failFeatureReports?: boolean;
}

export interface FakeRazerKeyboardState {
  pollingRateCode: number;
  idleTimeSeconds: number;
  batteryLevel: number;
  charging: number;
  brightness: number;
  effectArguments: number[];
}

type CommandHandler = (commandArguments: Uint8Array) => readonly number[];

export class FakeRazerKeyboard {
  opened = false;
  readonly vendorId = RAZER_VENDOR_ID;
  readonly productId: number;
  readonly productName = BLACKWIDOW_V3_MINI_PRODUCT_NAME;
  readonly collections: HIDCollectionInfo[];
  readonly sentRequests: Uint8Array[] = [];
  readonly state: FakeRazerKeyboardState = {
    pollingRateCode: 0x01,
    idleTimeSeconds: 900,
    batteryLevel: 0xff,
    charging: 0x01,
    brightness: 0x99,
    effectArguments: [0x01, 0x05, 0x03, 0x00, 0x00, 0x00],
  };
  private pendingReply: Uint8Array = new Uint8Array(REPORT_LENGTH);
  private remainingBusyPolls = 0;
  private readonly handlers: ReadonlyMap<string, CommandHandler>;

  constructor(private readonly options: FakeRazerKeyboardOptions = {}) {
    this.productId = options.productId ?? BLACKWIDOW_V3_MINI_WIRED_PRODUCT_ID;
    this.collections = options.collections ?? [razerControlCollection];
    this.handlers = this.commandHandlers();
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async sendFeatureReport(_reportId: number, data: BufferSource): Promise<void> {
    if (this.options.failFeatureReports) throw new Error("Failed to write the feature report.");
    const request = toBytes(data);
    this.sentRequests.push(request);
    this.pendingReply = this.answer(request);
    this.remainingBusyPolls = this.options.busyPollsPerRequest ?? 0;
  }

  async receiveFeatureReport(_reportId: number): Promise<DataView> {
    const reply = this.remainingBusyPolls > 0 ? busyReply() : this.pendingReply;
    this.remainingBusyPolls = Math.max(0, this.remainingBusyPolls - 1);
    const delivered = this.options.repliesWithReportIdPrefix ? Uint8Array.from([0, ...reply]) : reply.slice();
    return new DataView(delivered.buffer);
  }

  sentCommands(): string[] {
    return this.sentRequests.map((request) => commandKey(request[COMMAND_CLASS_OFFSET], request[COMMAND_ID_OFFSET]));
  }

  asHidDevice(): HIDDevice {
    return this as unknown as HIDDevice;
  }

  private answer(request: Uint8Array): Uint8Array {
    const reply = request.slice(0, REPORT_LENGTH);
    const handler = this.handlers.get(commandKey(request[COMMAND_CLASS_OFFSET], request[COMMAND_ID_OFFSET]));
    if (this.options.keyboardUnreachable) {
      reply[0] = RazerStatus.noResponse;
    } else if (!handler) {
      reply[0] = RazerStatus.notSupported;
    } else {
      const replyArguments = handler(request.slice(ARGUMENTS_OFFSET, ARGUMENTS_OFFSET + request[DATA_SIZE_OFFSET]));
      reply[0] = RazerStatus.success;
      reply[DATA_SIZE_OFFSET] = replyArguments.length;
      reply.fill(0, ARGUMENTS_OFFSET, CHECKSUM_OFFSET);
      reply.set(replyArguments, ARGUMENTS_OFFSET);
    }
    reply[CHECKSUM_OFFSET] = checksumOf(reply);
    return reply;
  }

  private commandHandlers(): ReadonlyMap<string, CommandHandler> {
    const state = this.state;
    const unlessIgnored = (write: (commandArguments: Uint8Array) => void): CommandHandler => (commandArguments) => {
      if (!this.options.ignoresWrites) write(commandArguments);
      return [...commandArguments];
    };
    return new Map<string, CommandHandler>([
      ["00:81", () => [0x02, 0x03]],
      ["00:85", () => [state.pollingRateCode]],
      ["00:05", unlessIgnored((commandArguments) => (state.pollingRateCode = commandArguments[0]))],
      ["07:80", () => [0x00, state.batteryLevel]],
      ["07:84", () => [0x00, state.charging]],
      ["07:83", () => [state.idleTimeSeconds >> 8, state.idleTimeSeconds & 0xff]],
      ["07:03", unlessIgnored((commandArguments) => {
        state.idleTimeSeconds = (commandArguments[0] << 8) | commandArguments[1];
      })],
      ["0f:84", (commandArguments) => [commandArguments[0], commandArguments[1], state.brightness]],
      ["0f:04", unlessIgnored((commandArguments) => (state.brightness = commandArguments[2]))],
      ["0f:82", () => state.effectArguments],
      ["0f:02", unlessIgnored((commandArguments) => (state.effectArguments = [...commandArguments]))],
    ]);
  }
}

function busyReply(): Uint8Array {
  const reply = new Uint8Array(REPORT_LENGTH);
  reply[0] = RazerStatus.busy;
  return reply;
}

function commandKey(commandClass: number, commandId: number): string {
  return [commandClass, commandId].map((value) => value.toString(16).padStart(2, "0")).join(":");
}

function checksumOf(report: Uint8Array): number {
  let checksum = 0;
  for (let offset = 2; offset < CHECKSUM_OFFSET; offset += 1) checksum ^= report[offset];
  return checksum;
}

function toBytes(data: BufferSource): Uint8Array {
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  return new Uint8Array(data).slice();
}
