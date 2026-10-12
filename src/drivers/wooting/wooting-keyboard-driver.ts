import { hasCollection } from "../../hid/collections";
import type { AnalogKeySource } from "../../keyboard/analog-keys";
import type { KeyboardProfileReader } from "../../keyboard/keyboard-profile";
import { decodeFirmwareVersion } from "../../protocol/wooting/wooting-codec";
import { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  WOOTING_ANALOG_USAGE,
  WOOTING_ANALOG_USAGE_PAGE,
  WOOTING_CONFIG_USAGE,
  WOOTING_CONFIG_USAGE_PAGE,
  WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS,
  WOOTING_VENDOR_ID,
  WootingCommand,
} from "../../protocol/wooting/wooting-constants";
import type { AuthorizedDeviceLister, KeyboardDriver, KeyboardIdentity, KeyboardSession } from "../keyboard-driver";
import { WootingAnalogKeySource } from "./wooting-analog-key-source";
import { WootingProfileReader } from "./wooting-profile-reader";

class WootingKeyboardSession implements KeyboardSession {
  readonly analogKeys: AnalogKeySource;
  readonly profiles: KeyboardProfileReader;
  private readonly commands: WootingCommandChannel;

  constructor(readonly device: HIDDevice, listAuthorizedDevices: AuthorizedDeviceLister) {
    this.commands = new WootingCommandChannel(device);
    this.analogKeys = new WootingAnalogKeySource(device, listAuthorizedDevices);
    this.profiles = new WootingProfileReader(this.commands);
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
  requestFilters: [
    { vendorId: WOOTING_VENDOR_ID, usagePage: WOOTING_CONFIG_USAGE_PAGE, usage: WOOTING_CONFIG_USAGE },
    { vendorId: WOOTING_VENDOR_ID, usagePage: WOOTING_ANALOG_USAGE_PAGE, usage: WOOTING_ANALOG_USAGE },
  ],

  supports(device) {
    return device.vendorId === WOOTING_VENDOR_ID
      && hasCollection(device, WOOTING_CONFIG_USAGE_PAGE, WOOTING_CONFIG_USAGE);
  },

  async open(device, listAuthorizedDevices) {
    if (!device.opened) await device.open();
    return new WootingKeyboardSession(device, listAuthorizedDevices);
  },
};
