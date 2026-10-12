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

export const analogReportAStartingToMove = capturedReply("61040008");
export const analogReportEscapePressed = capturedReply("0029c02c");
export const analogReportFourKeysHeld = capturedReply("430841fe" + "6216c0ca" + "45178009" + "a62cc1ff");
export const analogReportNoKeysHeld = capturedReply("");
