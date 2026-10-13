import { payloadOf } from "./wooting-80he-captures";

const RAZER_REPORT_LENGTH = 90;

function capturedReport(hexPrefix: string, checksum: number): Uint8Array {
  const report = new Uint8Array(RAZER_REPORT_LENGTH);
  report.set(payloadOf(hexPrefix));
  report[88] = checksum;
  return report;
}

export const BLACKWIDOW_V3_MINI_WIRED_PRODUCT_ID = 0x0258;
export const BLACKWIDOW_V3_MINI_RECEIVER_PRODUCT_ID = 0x0271;
export const BLACKWIDOW_V3_MINI_PRODUCT_NAME = "Razer BlackWidow V3 Mini";

export const firmwareVersionRequest = capturedReport("001f000000020081", 0x83);

export const firmwareVersionReply = capturedReport("021f0000000200810203", 0x82);
export const pollingRateReply = capturedReport("021f00000001008501", 0x85);
export const batteryLevelReply = capturedReport("021f00000002078000ff", 0x7a);
export const chargingStatusReply = capturedReport("021f0000000207840001", 0x80);
export const idleTimeReply = capturedReport("021f0000000207830384", 0x01);
export const matrixBrightnessReply = capturedReport("021f000000030f84010599", 0x15);
export const matrixEffectSpectrumReply = capturedReport("021f000000060f82010503000000", 0x8c);
export const pollingRateV2NotSupportedReply = capturedReport("051f0000000100c0", 0xc1);
export const receiverKeyboardOffFirmwareReply = capturedReport("041f000000020081", 0x83);

export interface VerifiedEffectWrite {
  readonly label: string;
  readonly effectArgumentsHex: string;
}

export const verifiedEffectWrites: readonly VerifiedEffectWrite[] = [
  { label: "static red", effectArgumentsHex: "010501000001ff0000" },
  { label: "breathing green", effectArgumentsHex: "01050201000100ff00" },
  { label: "breathing red and blue", effectArgumentsHex: "010502020002ff00000000ff" },
  { label: "breathing random", effectArgumentsHex: "010502000000" },
  { label: "reactive blue short", effectArgumentsHex: "0105050001010000ff" },
  { label: "reactive blue long", effectArgumentsHex: "0105050003010000ff" },
  { label: "starlight green medium", effectArgumentsHex: "01050700020100ff00" },
  { label: "starlight red and blue short", effectArgumentsHex: "010507000102ff00000000ff" },
  { label: "starlight random long", effectArgumentsHex: "010507000300" },
  { label: "wave left to right", effectArgumentsHex: "010504012800" },
  { label: "wave right to left", effectArgumentsHex: "010504022800" },
  { label: "off", effectArgumentsHex: "010500000000" },
  { label: "spectrum", effectArgumentsHex: "010503000000" },
];
