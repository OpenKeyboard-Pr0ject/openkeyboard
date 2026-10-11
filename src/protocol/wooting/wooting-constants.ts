export const WOOTING_VENDOR_ID = 0x31e3;
export const WOOTING_CONFIG_USAGE_PAGE = 0xff55;
export const WOOTING_CONFIG_USAGE = 0x01;
export const WOOTING_COMMAND_REPORT_ID = 0x01;

export const WOOTING_HARDWARE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([0x1402]);

export const WootingCommand = {
  getFirmwareVersion: 0x01,
} as const;

export type WootingCommandId = (typeof WootingCommand)[keyof typeof WootingCommand];
