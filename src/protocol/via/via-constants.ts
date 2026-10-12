export const VIA_USAGE_PAGE = 0xff60;
export const VIA_USAGE = 0x61;
export const VIA_REPORT_ID = 0x00;
export const VIA_REPORT_LENGTH = 32;
export const VIA_UNHANDLED_COMMAND = 0xff;
export const VIA_KEYMAP_CHUNK_BYTES = 28;
export const FIRST_VIA_PROTOCOL_WITH_MODERN_KEYCODES = 12;

export const ViaCommand = {
  getProtocolVersion: 0x01,
  getKeyboardValue: 0x02,
  getLayerCount: 0x11,
  getKeymapBuffer: 0x12,
  vialPrefix: 0xfe,
} as const;

export type ViaCommandId = (typeof ViaCommand)[keyof typeof ViaCommand];

export const ViaKeyboardValue = {
  layoutOptions: 0x02,
  firmwareVersion: 0x04,
} as const;

export const VialCommand = {
  getKeyboardId: 0x00,
  getDefinitionSize: 0x01,
  getDefinitionPage: 0x02,
} as const;

export const FIRST_VIAL_PROTOCOL_WITH_MODERN_KEYCODES = 6;
