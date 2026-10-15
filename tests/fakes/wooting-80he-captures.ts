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
export const keyboardProfileCurrentPayload = payloadOf("0a1408d09f011001180120e68c012800300238004800");
export const wootilitySensitivityHalfMillimeterPayload = payloadOf("0a1408d09f0110011801208090012800300238004800");
export const wootilitySensitivityHalfMillimeterReport = payloadOf(
  "d1da110116000a1408d09f0110011801208090012800300238004800",
);
export const keyboardProfileContinuousOffPayload = payloadOf("0a1408d09f011001180120e68c012800300238014800");
export const keyboardProfileRapidTriggerOffPayload = payloadOf("0a1408d09f011001180020868d012800300238004800");
export const keyboardProfileSensitivityLoweredPayload = payloadOf("0a1408d09f011001180120b386012800300238014800");

export const currentProfileIndexPayload = payloadOf("0000");
export const emptyPayload = payloadOf("");

export const typingProfileMetadataPayload = payloadOf(
  "0a0e547970696e672050726f66696c65120708d001100718071a0c776f6f743a703a626c61636b",
);
export const typingProfileSettingsPayload = payloadOf("0a1408ffdf011001180020e68c012800300238014800");

export const ultraProfileMetadataPayload = payloadOf(
  "0a1254656e5a20556c7472612050726f66696c65120708ff01102818281a12737769746368793a67616d6572556c747261",
);
export const ultraProfileSettingsPayload = payloadOf("0a0e083f10011801201a280138004801");
export const ultraProfileActuationPayload = payloadOf("12180a16c234e134e234e334a03580fe02c0fe02e0fe02a6ff02");

export function replyCarrying(command: number, payload: Uint8Array): Uint8Array {
  const reply = new Uint8Array(6 + payload.length);
  reply.set([0xd1, 0xda, command, 0x88, payload.length & 0xff, payload.length >> 8]);
  reply.set(payload, 6);
  return reply;
}

export const typingQKeyActuationWritePayload = payloadOf("220608c18080c005");
export const typingQKeyActuationReadPayload = payloadOf("22070a05c18080c005");
export const typingQKeyRapidTriggerWritePayload = payloadOf("0a0408411801");
export const typingQAndWRapidTriggerWritePayload = payloadOf("0a0808421204089993010a0408411801");
export const typingQAndWRapidTriggerReadPayload = payloadOf("0a090a01421204089993010a050a01411801");
export const typingSettingsWithQSensitivityPayload = payloadOf("0a1408ffdf011001180020cd89012800300238014800");

export const analogReportAStartingToMove = capturedReply("61040008");
export const analogReportEscapePressed = capturedReply("0029c02c");
export const analogReportFourKeysHeld = capturedReply("430841fe" + "6216c0ca" + "45178009" + "a62cc1ff");
export const analogReportNoKeysHeld = capturedReply("");

const TENZ_GRADIENT_RGB_ROW = "0a410a3f"
  + "80f003".repeat(5) + "80f403".repeat(4) + "a0f703".repeat(4) + "e0fa03".repeat(4) + "e0fe03".repeat(4);

export const tenzRgbRowsPayload = payloadOf(TENZ_GRADIENT_RGB_ROW.repeat(3));
export const tenzRgbCorePayload = payloadOf("0a0b08b30110ffff0318ffff032200");
export const typingRgbCorePayload = payloadOf("0a0b08ff0110ffff0318ffff03220a0a080a06080010101800");
export const ultraRgbCorePayload = payloadOf("0a0a087010ffff0318ffff03");
