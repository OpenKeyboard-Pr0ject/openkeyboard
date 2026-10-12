import { payloadOf } from "./wooting-80he-captures";

type InputReportListener = (event: HIDInputReportEvent) => void;

const REPORT_LENGTH = 32;
const UNHANDLED = 0xff;

export const TEST_MACROPAD_DEFINITION_JSON = JSON.stringify({
  name: "Test Macropad",
  matrix: { rows: 2, cols: 3 },
  layouts: {
    labels: [["Bottom row", "Three keys", "Wide key"]],
    keymap: [
      ["0,0", "0,1", "0,2", { d: true }, "Logo"],
      ["1,0\n\n\n0,0", "1,1\n\n\n0,0", "1,2\n\n\n0,0"],
      [{ y: -1, w: 3 }, "1,0\n\n\n0,1"],
      [{ x: 3.5 }, "0,0\n\n\n\n\n\n\n\n\ne"],
    ],
  },
});

export const TEST_MACROPAD_DEFINITION_XZ = payloadOf(
  "fd377a585a000004e6d6b4460200210116000000742fe5a3e0011700b75d003d8889c65436c3174fe4e6be7a4e39158c3281e41c9bda02"
  + "5dc935bb9c1768e8c1c9f28e607234317cf012ae3ba335f8e84dba66127a9208b02cb4be00c5a80c471de408a868562f17df161b7b3e"
  + "5fc207a711646a1c051d636781c71f14ff3f4de7923b9a1bf1a99587a54051a2b6d1b53ea7dfe7dd5325bf4cd400dc0bc1d01da555b0"
  + "b874eb6d38a592148dbca66d4ae1117ba99cfc45c73ffdbf1cc25db8862cb00c808c1e3c7b734affb40a33248154a26074b90000000ee"
  + "c12e48769f0db0001d30198020000c98eef11b1c467fb020000000004595a",
);

export const TEST_MACROPAD_LAYERS: readonly (readonly number[])[] = [
  [0x0004, 0x0005, 0x0006, 0x002c, 0x5221, 0x0001],
  [0x001e, 0x001f, 0x0020, 0x00a9, 0x0001, 0x0000],
  [0x7c00, 0x2104, 0x412c, 0x0001, 0x0001, 0x0001],
];

export interface FakeViaKeyboardOptions {
  readonly viaProtocolVersion?: number;
  readonly vialProtocolVersion?: number;
  readonly vialDefinition?: Uint8Array;
  readonly layers?: readonly (readonly number[])[];
  readonly layoutOptions?: number;
  readonly supportsLayoutOptions?: boolean;
}

export class FakeViaKeyboard {
  opened = false;
  readonly vendorId = 0xfeed;
  readonly productId = 0x6060;
  readonly productName = "Test Macropad";
  readonly collections: HIDCollectionInfo[] = [
    { usagePage: 0xff60, usage: 0x61, children: [], inputReports: [], outputReports: [], featureReports: [] },
  ];
  readonly sentReports: Uint8Array[] = [];
  private readonly inputListeners = new Set<InputReportListener>();

  constructor(private readonly options: FakeViaKeyboardOptions = {}) {}

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
  }

  async sendReport(_reportId: number, data: BufferSource): Promise<void> {
    const request = new Uint8Array(data as ArrayBuffer | Uint8Array<ArrayBuffer>).slice();
    this.sentReports.push(request);
    const reply = this.replyTo(request);
    queueMicrotask(() => this.emit(reply));
  }

  addEventListener(_type: "inputreport", listener: InputReportListener): void {
    this.inputListeners.add(listener);
  }

  removeEventListener(_type: "inputreport", listener: InputReportListener): void {
    this.inputListeners.delete(listener);
  }

  asHidDevice(): HIDDevice {
    return this as unknown as HIDDevice;
  }

  private emit(reply: Uint8Array): void {
    const event = { reportId: 0, data: new DataView(reply.buffer), device: this } as unknown as HIDInputReportEvent;
    [...this.inputListeners].forEach((listener) => listener(event));
  }

  private replyTo(request: Uint8Array): Uint8Array {
    const reply = request.slice(0, REPORT_LENGTH);
    switch (request[0]) {
      case 0x01:
        reply.set([(this.viaProtocol() >> 8) & 0xff, this.viaProtocol() & 0xff], 1);
        return reply;
      case 0x02:
        return this.keyboardValueReply(reply);
      case 0x11:
        reply[1] = this.layers().length;
        return reply;
      case 0x12:
        return this.keymapBufferReply(reply);
      case 0xfe:
        return this.vialReply(request);
      default:
        reply[0] = UNHANDLED;
        return reply;
    }
  }

  private keyboardValueReply(reply: Uint8Array): Uint8Array {
    if (reply[1] !== 0x02 || this.options.supportsLayoutOptions === false) {
      reply[0] = UNHANDLED;
      return reply;
    }
    new DataView(reply.buffer).setUint32(2, this.options.layoutOptions ?? 0, false);
    return reply;
  }

  private keymapBufferReply(reply: Uint8Array): Uint8Array {
    const offset = (reply[1] << 8) | reply[2];
    const size = reply[3];
    const keymapBytes = this.keymapBytes();
    reply.set(keymapBytes.subarray(offset, offset + size), 4);
    return reply;
  }

  private vialReply(request: Uint8Array): Uint8Array {
    const reply = new Uint8Array(REPORT_LENGTH);
    const definition = this.options.vialDefinition;
    if (this.options.vialProtocolVersion === undefined || !definition) {
      reply.set(request.slice(0, REPORT_LENGTH));
      reply[0] = UNHANDLED;
      return reply;
    }
    const view = new DataView(reply.buffer);
    if (request[1] === 0x00) {
      view.setUint32(0, this.options.vialProtocolVersion, true);
      reply.set([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01], 4);
    } else if (request[1] === 0x01) {
      view.setUint32(0, definition.length, true);
    } else if (request[1] === 0x02) {
      const page = request[2] | (request[3] << 8);
      reply.set(definition.subarray(page * REPORT_LENGTH, (page + 1) * REPORT_LENGTH));
    }
    return reply;
  }

  private keymapBytes(): Uint8Array {
    const keycodes = this.layers().flat();
    const bytes = new Uint8Array(keycodes.length * 2);
    keycodes.forEach((keycode, index) => bytes.set([keycode >> 8, keycode & 0xff], index * 2));
    return bytes;
  }

  private layers(): readonly (readonly number[])[] {
    return this.options.layers ?? TEST_MACROPAD_LAYERS;
  }

  private viaProtocol(): number {
    return this.options.viaProtocolVersion ?? 9;
  }
}
