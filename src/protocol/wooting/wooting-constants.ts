export const WOOTING_VENDOR_ID = 0x31e3;
export const WOOTING_CONFIG_USAGE_PAGE = 0xff55;
export const WOOTING_CONFIG_USAGE = 0x01;
export const WOOTING_ANALOG_USAGE_PAGE = 0xff53;
export const WOOTING_ANALOG_USAGE = 0x01;
export const WOOTING_COMMAND_REPORT_ID = 0x01;

export const WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([0x1402]);

export const WootingCommand = {
  getFirmwareVersion: 0x01,
  getCurrentProfileIndex: 0x0b,
  getKeyboardProfile: 0x27,
  getKeyMapping: 0x30,
  getActuationProfile: 0x31,
  getProfileMetadata: 0x37,
} as const;

export type WootingCommandId = (typeof WootingCommand)[keyof typeof WootingCommand];
