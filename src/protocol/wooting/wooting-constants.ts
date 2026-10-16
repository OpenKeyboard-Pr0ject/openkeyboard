export const WOOTING_VENDOR_ID = 0x31e3;
export const WOOTING_CONFIG_USAGE_PAGE = 0xff55;
export const WOOTING_CONFIG_USAGE = 0x01;
export const WOOTING_ANALOG_USAGE_PAGE = 0xff53;
export const WOOTING_ANALOG_USAGE = 0x01;
export const WOOTING_COMMAND_REPORT_ID = 0x01;

export const WOOTING_80HE_PRODUCT_ID = 0x1402;

export const WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([WOOTING_80HE_PRODUCT_ID]);
export const WOOTING_WRITE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([WOOTING_80HE_PRODUCT_ID]);
export const WOOTING_RGB_WRITE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([WOOTING_80HE_PRODUCT_ID]);

export const WootingCommand = {
  getFirmwareVersion: 0x01,
  saveRgbProfile: 0x08,
  getCurrentProfileIndex: 0x0b,
  getKeyboardProfile: 0x27,
  getKeyMapping: 0x30,
  getActuationProfile: 0x31,
  getPerKeyRapidTrigger: 0x3d,
  getProfileMetadata: 0x37,
  getRgbUpperRows: 0x23,
  getRgbLowerRows: 0x24,
  getRgbCore: 0x32,
  getRgbFrame: 0x4a,
} as const;

export type WootingCommandId = (typeof WootingCommand)[keyof typeof WootingCommand];

export const WootingReportType = {
  rgbUpperRows: 0x0e,
  rgbLowerRows: 0x0f,
  keyboardProfileSettings: 0x11,
  perKeyActuation: 0x15,
  perKeyRapidTrigger: 0x1d,
  rgbCore: 0x16,
} as const;

export const WOOTING_PREVIEW_STORAGE = 0x00;

export type WootingReportTypeId = (typeof WootingReportType)[keyof typeof WootingReportType];

export const WOOTING_PROFILE_SLOT_COUNT = 4;

export const RAPID_TRIGGER_SENSITIVITY_RANGE = { min: 0.1, max: 2.35, step: 0.05 } as const;
export const ACTUATION_POINT_RANGE = { min: 0.1, max: 4.0, step: 0.05 } as const;
