const CAPTURED_REPLY_LENGTH = 64;

function capturedReply(hexPrefix: string): Uint8Array {
  const reply = new Uint8Array(CAPTURED_REPLY_LENGTH);
  reply.set((hexPrefix.match(/../g) ?? []).map((byte) => parseInt(byte, 16)));
  return reply;
}

export const WOOTING_80HE_PRODUCT_ID = 0x1402;
export const WOOTING_80HE_PRODUCT_NAME = "Wooting 80HE TenZ";

export const firmwareVersionReply = capturedReply("d1da0188030002" + "0e00");
export const rejectedCommandReply = capturedReply("d1da01ff");

export function payloadOf(hex: string): Uint8Array {
  return Uint8Array.from((hex.match(/../g) ?? []).map((byte) => parseInt(byte, 16)));
}

export const profileMetadataPayload = payloadOf(
  "0a0c54656e5a2050726f66696c65120708ff01102818281a0d737769746368793a67616d6572",
);
export const actuationProfilePayload = payloadOf(
  "222f0a2d8080bcff06c080bcff06c28098b404e080bcff06e18098b404e28098b404e38098b404a08198b404a681bcff06",
);
export const keyMappingPayload = payloadOf([
  "0a170a15263738393a3b3c3d3eff3f404142e64345ffffffff",
  "0a170a15321b1c1d1e1f20212223242a2bf4274648ffffffff",
  "0a170a152811170512141915090f102c2dff2e494bffffffff",
  "0a170a15360113040607080a0b0c30312eff25ffffffffffff",
  "0a170a1564611a180316020e0d333435f2ff684fffffffffff",
  "0a170a15636665f629ff29ff29f56967e7ff4d4e4cffffffff",
].join(""));
export const keyboardProfilePayload = payloadOf("0a1408d09f011001180120868d012800300238004800");
export const keyboardProfileContinuousOffPayload = payloadOf("0a1408d09f011001180120e68c012800300238014800");
export const keyboardProfileRapidTriggerOffPayload = payloadOf("0a1408d09f011001180020868d012800300238004800");
export const keyboardProfileSensitivityLoweredPayload = payloadOf("0a1408d09f011001180120b386012800300238014800");

export const currentProfileIndexPayload = payloadOf("0000");

export function replyCarrying(command: number, payload: Uint8Array): Uint8Array {
  const reply = new Uint8Array(6 + payload.length);
  reply.set([0xd1, 0xda, command, 0x88, payload.length & 0xff, payload.length >> 8]);
  reply.set(payload, 6);
  return reply;
}

export const analogReportAStartingToMove = capturedReply("61040008");
export const analogReportEscapePressed = capturedReply("0029c02c");
export const analogReportFourKeysHeld = capturedReply("430841fe" + "6216c0ca" + "45178009" + "a62cc1ff");
export const analogReportNoKeysHeld = capturedReply("");
