export const RAZER_VENDOR_ID = 0x1532;
export const RAZER_CONTROL_USAGE_PAGE = 0x0c;
export const RAZER_CONTROL_USAGE = 0x01;
export const RAZER_CONTROL_REPORT_ID = 0x00;
export const RAZER_REPORT_LENGTH = 90;
export const RAZER_TRANSACTION_ID = 0x1f;

export const RazerProductId = {
  blackWidowV3MiniWired: 0x0258,
  blackWidowV3MiniReceiver: 0x0271,
} as const;

export const RAZER_SUPPORTED_PRODUCT_IDS: ReadonlySet<number> = new Set(Object.values(RazerProductId));
export const RAZER_HARDWARE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([
  RazerProductId.blackWidowV3MiniWired,
]);
export const RAZER_WRITE_VERIFIED_PRODUCT_IDS: ReadonlySet<number> = new Set([
  RazerProductId.blackWidowV3MiniWired,
]);

export interface RazerCommand {
  readonly commandClass: number;
  readonly commandId: number;
  readonly dataSize: number;
}

export const RazerCommands = {
  getFirmwareVersion: { commandClass: 0x00, commandId: 0x81, dataSize: 0x02 },
  getPollingRate: { commandClass: 0x00, commandId: 0x85, dataSize: 0x01 },
  setPollingRate: { commandClass: 0x00, commandId: 0x05, dataSize: 0x01 },
  getBatteryLevel: { commandClass: 0x07, commandId: 0x80, dataSize: 0x02 },
  getIdleTime: { commandClass: 0x07, commandId: 0x83, dataSize: 0x02 },
  setIdleTime: { commandClass: 0x07, commandId: 0x03, dataSize: 0x02 },
  getChargingStatus: { commandClass: 0x07, commandId: 0x84, dataSize: 0x02 },
  getMatrixBrightness: { commandClass: 0x0f, commandId: 0x84, dataSize: 0x03 },
  setMatrixBrightness: { commandClass: 0x0f, commandId: 0x04, dataSize: 0x03 },
  getMatrixEffect: { commandClass: 0x0f, commandId: 0x82, dataSize: 0x0c },
  setMatrixEffect: { commandClass: 0x0f, commandId: 0x02, dataSize: 0x00 },
} as const satisfies Record<string, RazerCommand>;

export const RazerStatus = {
  new: 0x00,
  busy: 0x01,
  success: 0x02,
  failure: 0x03,
  noResponse: 0x04,
  notSupported: 0x05,
} as const;

export const RAZER_VARIABLE_STORAGE = 0x01;
export const RAZER_BACKLIGHT_LED = 0x05;

export const RazerPollingRateCode: ReadonlyMap<number, number> = new Map([
  [1000, 0x01],
  [500, 0x02],
  [125, 0x08],
]);

export const RAZER_IDLE_TIME_RANGE = { min: 60, max: 900, step: 60 } as const;
