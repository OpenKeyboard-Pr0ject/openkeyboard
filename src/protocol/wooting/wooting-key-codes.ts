const FIRST_STANDARD_KEY_CODE = 0x01;
const LAST_STANDARD_KEY_CODE = 0x62;
const STANDARD_KEY_HID_OFFSET = 3;
const FIRST_MODIFIER_KEY_CODE = 0x63;
const LAST_MODIFIER_KEY_CODE = 0x6a;
const FIRST_MODIFIER_HID_USAGE = 0xe0;

export const UNASSIGNED_KEY_CODE = 0xff;
export const NO_HID_USAGE = 0x00;

export function hidUsageForWootingKeyCode(code: number): number {
  if (code >= FIRST_STANDARD_KEY_CODE && code <= LAST_STANDARD_KEY_CODE) return code + STANDARD_KEY_HID_OFFSET;
  if (code >= FIRST_MODIFIER_KEY_CODE && code <= LAST_MODIFIER_KEY_CODE) {
    return FIRST_MODIFIER_HID_USAGE + code - FIRST_MODIFIER_KEY_CODE;
  }
  return NO_HID_USAGE;
}
