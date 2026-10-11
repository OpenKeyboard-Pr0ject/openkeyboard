import { hasCollection } from "../../hid/collections";
import { decodeFirmwareVersion } from "../../protocol/wooting/wooting-codec";
import { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  WOOTING_CONFIG_USAGE,
  WOOTING_CONFIG_USAGE_PAGE,
  WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS,
  WOOTING_VENDOR_ID,
  WootingCommand,
} from "../../protocol/wooting/wooting-constants";
import type { KeyboardDriver, KeyboardIdentity, KeyboardSession } from "../keyboard-driver";

class WootingKeyboardSession implements KeyboardSession {
  private readonly commands: WootingCommandChannel;

  constructor(readonly device: HIDDevice) {
    this.commands = new WootingCommandChannel(device);
  }

  async readIdentity(): Promise<KeyboardIdentity> {
    const firmwarePayload = await this.commands.request(WootingCommand.getFirmwareVersion);
    return {
      vendorName: "Wooting",
      productName: this.device.productName,
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      firmwareVersion: decodeFirmwareVersion(firmwarePayload),
      hardwareVerified: WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS.has(this.device.productId),
    };
  }

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close();
  }
}

export const wootingKeyboardDriver: KeyboardDriver = {
  requestFilters: [{ vendorId: WOOTING_VENDOR_ID, usagePage: WOOTING_CONFIG_USAGE_PAGE, usage: WOOTING_CONFIG_USAGE }],

  supports(device) {
    return device.vendorId === WOOTING_VENDOR_ID
      && hasCollection(device, WOOTING_CONFIG_USAGE_PAGE, WOOTING_CONFIG_USAGE);
  },

  async open(device) {
    if (!device.opened) await device.open();
    return new WootingKeyboardSession(device);
  },
};
