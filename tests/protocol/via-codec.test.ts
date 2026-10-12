import { describe, expect, it } from "vitest";
import {
  decodeKeycodes,
  decodeVialKeyboardId,
  encodeViaRequest,
  isViaReplyTo,
  isVialKeyboardIdReply,
  viaReplyData,
  ViaCommandNotSupportedError,
  ViaProtocolError,
} from "../../src/protocol/via/via-codec";
import { ViaCommand } from "../../src/protocol/via/via-constants";

describe("encodeViaRequest", () => {
  it("builds a 32-byte report that starts with the command id", () => {
    const request = encodeViaRequest(ViaCommand.getKeymapBuffer, [0x00, 0x1c, 0x1c]);

    expect([request.length, ...request.subarray(0, 5)]).toEqual([32, 0x12, 0x00, 0x1c, 0x1c, 0x00]);
  });

  it("rejects arguments that do not fit next to the command id", () => {
    expect(() => encodeViaRequest(ViaCommand.getKeymapBuffer, new Array(32).fill(0))).toThrow(ViaProtocolError);
  });
});

describe("VIA replies", () => {
  it("recognises a reply that echoes the command id", () => {
    expect(isViaReplyTo(new Uint8Array([0x11, 0x04]), ViaCommand.getLayerCount)).toBe(true);
  });

  it("recognises the unhandled marker as the answer to any command", () => {
    expect(isViaReplyTo(new Uint8Array([0xff]), ViaCommand.getLayerCount)).toBe(true);
  });

  it("ignores reports that answer another command", () => {
    expect(isViaReplyTo(new Uint8Array([0x01, 0x00, 0x0c]), ViaCommand.getLayerCount)).toBe(false);
  });

  it("returns the data after the command id", () => {
    expect([...viaReplyData(new Uint8Array([0x01, 0x00, 0x0c]), ViaCommand.getProtocolVersion)]).toEqual([0x00, 0x0c]);
  });

  it("reports a command the firmware does not handle", () => {
    expect(() => viaReplyData(new Uint8Array([0xff, 0x02]), ViaCommand.getKeyboardValue))
      .toThrow(ViaCommandNotSupportedError);
  });
});

describe("Vial keyboard id", () => {
  const reply = new Uint8Array([0x06, 0, 0, 0, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]);

  it("reads the little-endian Vial protocol version", () => {
    expect(decodeVialKeyboardId(reply).protocolVersion).toBe(6);
  });

  it("formats the keyboard uid as a little-endian 64-bit hex number", () => {
    expect(decodeVialKeyboardId(reply).keyboardUid).toBe("0102030405060708");
  });

  it("treats the unhandled marker as a keyboard without Vial", () => {
    expect(isVialKeyboardIdReply(new Uint8Array([0xff, 0x00, 0x00, 0x00]))).toBe(false);
  });
});

describe("decodeKeycodes", () => {
  it("reads big-endian 16-bit keycodes", () => {
    expect(decodeKeycodes(new Uint8Array([0x00, 0x04, 0x52, 0x21]))).toEqual([0x0004, 0x5221]);
  });
});
