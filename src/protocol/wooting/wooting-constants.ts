export const WOOTING_VENDOR_ID = 0x31e3;
export const WOOTING_CONFIG_USAGE_PAGE = 0xff55;
export const WOOTING_CONFIG_USAGE = 0x01;
export const WOOTING_ANALOG_USAGE_PAGE = 0xff53;
export const WOOTING_ANALOG_USAGE = 0x01;
export const WOOTING_COMMAND_REPORT_ID = 0x01;

export const WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([0x1402]);
export const WOOTING_WRITE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([0x1402]);

export const WootingCommand = {
  getFirmwareVersion: 0x01,
  getCurrentProfileIndex: 0x0b,
  getKeyboardProfile: 0x27,
  getKeyMapping: 0x30,
  getActuationProfile: 0x31,
  getProfileMetadata: 0x37,
} as const;

export type WootingCommandId = (typeof WootingCommand)[keyof typeof WootingCommand];

export const WootingReportType = {
  settingsUpdateMarker: 0x1d,
  keyboardProfileSettings: 0x11,
} as const;

export type WootingReportTypeId = (typeof WootingReportType)[keyof typeof WootingReportType];

export const WootingReportStorage = {
  preview: 0x00,
  saved: 0x01,
} as const;

export type WootingReportStorageId = (typeof WootingReportStorage)[keyof typeof WootingReportStorage];

export const RAPID_TRIGGER_SENSITIVITY_RANGE = { min: 0.1, max: 2.35, step: 0.05 } as const;
export const ACTUATION_POINT_RANGE = { min: 0.1, max: 4.0, step: 0.05 } as const;
