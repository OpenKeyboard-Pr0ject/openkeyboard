import { hasCollection } from "../../hid/collections";
import type { KeyboardDefinitionLoader, KeymapReader } from "../../keyboard/keymap";
import type { QmkKeycodeGeneration } from "../../protocol/via/qmk-keycodes";
import { decodeVialKeyboardId, isVialKeyboardIdReply, readUint16BigEndian, type VialKeyboardId } from "../../protocol/via/via-codec";
import { ViaCommandChannel } from "../../protocol/via/via-command-channel";
import {
  FIRST_VIA_PROTOCOL_WITH_MODERN_KEYCODES,
  FIRST_VIAL_PROTOCOL_WITH_MODERN_KEYCODES,
  VIA_USAGE,
  VIA_USAGE_PAGE,
  ViaCommand,
  VialCommand,
} from "../../protocol/via/via-constants";
import type { KeyboardDriver, KeyboardIdentity, KeyboardSession } from "../keyboard-driver";
import { ViaKeymapReader } from "./via-keymap-reader";

interface ViaDialect {
  readonly viaProtocolVersion: number;
  readonly vial?: VialKeyboardId;
}

class ViaKeyboardSession implements KeyboardSession {
  readonly keymap: KeymapReader;
  readonly definitionLoader?: KeyboardDefinitionLoader;

  constructor(readonly device: HIDDevice, channel: ViaCommandChannel, private readonly dialect: ViaDialect) {
    const reader = new ViaKeymapReader({
      channel,
      keycodeGeneration: keycodeGenerationOf(dialect),
      hasEmbeddedDefinition: dialect.vial !== undefined,
    });
    this.keymap = reader;
    if (!dialect.vial) this.definitionLoader = reader;
  }

  async readIdentity(): Promise<KeyboardIdentity> {
    return {
      vendorName: this.dialect.vial ? "QMK (Vial)" : "QMK (VIA)",
      productName: this.device.productName,
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      firmwareVersion: protocolSummary(this.dialect),
      hardwareVerified: false,
    };
  }

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close();
  }
}

export const viaKeyboardDriver: KeyboardDriver = {
  requestFilters: [{ usagePage: VIA_USAGE_PAGE, usage: VIA_USAGE }],

  supports(device) {
    return hasCollection(device, VIA_USAGE_PAGE, VIA_USAGE);
  },

  async open(device) {
    if (!device.opened) await device.open();
    const channel = new ViaCommandChannel(device);
    return new ViaKeyboardSession(device, channel, await detectDialect(channel));
  },
};

async function detectDialect(channel: ViaCommandChannel): Promise<ViaDialect> {
  const viaProtocolVersion = readUint16BigEndian(await channel.request(ViaCommand.getProtocolVersion), 0);
  const vialReply = await channel.requestVial(VialCommand.getKeyboardId);
  if (!isVialKeyboardIdReply(vialReply)) return { viaProtocolVersion };
  return { viaProtocolVersion, vial: decodeVialKeyboardId(vialReply) };
}

function keycodeGenerationOf(dialect: ViaDialect): QmkKeycodeGeneration {
  const modern = dialect.vial
    ? dialect.vial.protocolVersion >= FIRST_VIAL_PROTOCOL_WITH_MODERN_KEYCODES
    : dialect.viaProtocolVersion >= FIRST_VIA_PROTOCOL_WITH_MODERN_KEYCODES;
  return modern ? "v6" : "v5";
}

function protocolSummary(dialect: ViaDialect): string {
  const via = `VIA protocol ${dialect.viaProtocolVersion}`;
  return dialect.vial ? `${via}, Vial protocol ${dialect.vial.protocolVersion}` : via;
}
