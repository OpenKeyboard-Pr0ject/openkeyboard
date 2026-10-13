import { featureReportByteLength, hasCollection } from "../../hid/collections";
import type { KeyboardDeviceSettingsEditor, KeyboardDeviceSettingsReader } from "../../keyboard/device-settings";
import type { KeyboardLightingEditor, KeyboardLightingReader } from "../../keyboard/lighting";
import { decodeRazerFirmwareVersion } from "../../protocol/razer/razer-codec";
import { RazerCommandChannel } from "../../protocol/razer/razer-command-channel";
import {
  RAZER_CONTROL_REPORT_ID,
  RAZER_CONTROL_USAGE,
  RAZER_CONTROL_USAGE_PAGE,
  RAZER_HARDWARE_VERIFIED_PRODUCT_IDS,
  RAZER_REPORT_LENGTH,
  RAZER_SUPPORTED_PRODUCT_IDS,
  RAZER_VENDOR_ID,
  RAZER_WRITE_VERIFIED_PRODUCT_IDS,
  RazerCommands,
} from "../../protocol/razer/razer-constants";
import type { KeyboardDriver, KeyboardIdentity, KeyboardSession } from "../keyboard-driver";
import { RazerDeviceSettings } from "./razer-device-settings";
import { RazerLighting } from "./razer-lighting";

class RazerKeyboardSession implements KeyboardSession {
  readonly lighting: KeyboardLightingReader;
  readonly lightingEditor?: KeyboardLightingEditor;
  readonly deviceSettings: KeyboardDeviceSettingsReader;
  readonly deviceSettingsEditor?: KeyboardDeviceSettingsEditor;
  private readonly channel: RazerCommandChannel;

  constructor(readonly device: HIDDevice) {
    this.channel = new RazerCommandChannel(device);
    const lighting = new RazerLighting(this.channel);
    const deviceSettings = new RazerDeviceSettings(this.channel);
    this.lighting = lighting;
    this.deviceSettings = deviceSettings;
    if (RAZER_WRITE_VERIFIED_PRODUCT_IDS.has(device.productId)) {
      this.lightingEditor = lighting;
      this.deviceSettingsEditor = deviceSettings;
    }
  }

  async readIdentity(): Promise<KeyboardIdentity> {
    const firmwareReply = await this.channel.request(RazerCommands.getFirmwareVersion);
    return {
      vendorName: "Razer",
      productName: this.device.productName,
      vendorId: this.device.vendorId,
      productId: this.device.productId,
      firmwareVersion: decodeRazerFirmwareVersion(firmwareReply),
      hardwareVerified: RAZER_HARDWARE_VERIFIED_PRODUCT_IDS.has(this.device.productId),
    };
  }

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close();
  }
}

export const razerKeyboardDriver: KeyboardDriver = {
  requestFilters: [...RAZER_SUPPORTED_PRODUCT_IDS].map((productId) => ({
    vendorId: RAZER_VENDOR_ID,
    productId,
    usagePage: RAZER_CONTROL_USAGE_PAGE,
    usage: RAZER_CONTROL_USAGE,
  })),

  supports(device) {
    return device.vendorId === RAZER_VENDOR_ID
      && RAZER_SUPPORTED_PRODUCT_IDS.has(device.productId)
      && hasCollection(device, RAZER_CONTROL_USAGE_PAGE, RAZER_CONTROL_USAGE)
      && featureReportByteLength(device, RAZER_CONTROL_REPORT_ID) === RAZER_REPORT_LENGTH;
  },

  async open(device) {
    if (!device.opened) await device.open();
    return new RazerKeyboardSession(device);
  },

  explainUnusableInterface(device) {
    const knownProduct = device.vendorId === RAZER_VENDOR_ID && RAZER_SUPPORTED_PRODUCT_IDS.has(device.productId);
    if (!knownProduct || this.supports(device)) return undefined;
    return `The browser shared other parts of the ${device.productName}, but not its control interface, `
      + "so OpenKeyboard cannot read or change its settings. On Windows the keyboard describes that interface "
      + "without any report fields, and Chrome does not offer such an interface to web pages. "
      + "Use the OpenKeyboard desktop app to change this keyboard's settings.";
  },
};
