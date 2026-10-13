import { describe, expect, it } from "vitest";
import {
  decodeRazerFirmwareVersion,
  decodeRazerReplyArguments,
  encodeRazerRequest,
  isRazerReplyPending,
  RazerCommandNotSupportedError,
  RazerCommandRejectedError,
  RazerKeyboardNotRespondingError,
  RazerProtocolError,
} from "../../src/protocol/razer/razer-codec";
import { RazerCommands } from "../../src/protocol/razer/razer-constants";
import {
  firmwareVersionReply,
  firmwareVersionRequest,
  matrixEffectSpectrumReply,
  pollingRateV2NotSupportedReply,
  receiverKeyboardOffFirmwareReply,
} from "../fakes/razer-blackwidow-v3-mini-captures";

const pollingRateV2 = { commandClass: 0x00, commandId: 0xc0, dataSize: 0x01 };

function withStatus(reply: Uint8Array, status: number): Uint8Array {
  const changed = reply.slice();
  changed[0] = status;
  return changed;
}

describe("encodeRazerRequest", () => {
  it("encodes the firmware version request exactly as sent to the BlackWidow V3 Mini", () => {
    expect(encodeRazerRequest(RazerCommands.getFirmwareVersion)).toEqual(firmwareVersionRequest);
  });

  it("places the arguments after the command and covers them with the checksum", () => {
    const request = encodeRazerRequest(RazerCommands.setMatrixBrightness, [0x01, 0x05, 0x66]);

    expect([...request.subarray(0, 11)]).toEqual([0x00, 0x1f, 0x00, 0x00, 0x00, 0x03, 0x0f, 0x04, 0x01, 0x05, 0x66]);
    expect(request[88]).toBe(0x03 ^ 0x0f ^ 0x04 ^ 0x01 ^ 0x05 ^ 0x66);
  });

  it("sizes an effect request by its arguments", () => {
    const request = encodeRazerRequest(RazerCommands.setMatrixEffect, [0x01, 0x05, 0x01, 0, 0, 0x01, 0xff, 0, 0]);

    expect(request[5]).toBe(9);
  });

  it("refuses more arguments than a report carries", () => {
    expect(() => encodeRazerRequest(RazerCommands.setMatrixEffect, new Array(81).fill(0))).toThrow(RazerProtocolError);
  });
});

describe("decodeRazerReplyArguments", () => {
  it("returns the arguments of a successful reply cut at the declared size", () => {
    expect([...decodeRazerReplyArguments(firmwareVersionReply, RazerCommands.getFirmwareVersion)]).toEqual([2, 3]);
  });

  it("returns every argument of the lighting effect reply", () => {
    const effect = decodeRazerReplyArguments(matrixEffectSpectrumReply, RazerCommands.getMatrixEffect);

    expect([...effect]).toEqual([0x01, 0x05, 0x03, 0x00, 0x00, 0x00]);
  });

  it("reports a command the keyboard does not support", () => {
    expect(() => decodeRazerReplyArguments(pollingRateV2NotSupportedReply, pollingRateV2))
      .toThrow(RazerCommandNotSupportedError);
  });

  it("explains that the receiver could not reach the keyboard", () => {
    expect(() => decodeRazerReplyArguments(receiverKeyboardOffFirmwareReply, RazerCommands.getFirmwareVersion))
      .toThrow(RazerKeyboardNotRespondingError);
  });

  it("reports a failed command with its status", () => {
    const failed = withStatus(firmwareVersionReply, 0x03);

    expect(() => decodeRazerReplyArguments(failed, RazerCommands.getFirmwareVersion))
      .toThrow(new RazerCommandRejectedError(RazerCommands.getFirmwareVersion, 0x03));
  });

  it("rejects a reply with a wrong checksum", () => {
    const corrupted = firmwareVersionReply.slice();
    corrupted[9] = 0x04;

    expect(() => decodeRazerReplyArguments(corrupted, RazerCommands.getFirmwareVersion)).toThrow(/checksum/);
  });

  it("rejects a reply to another command", () => {
    expect(() => decodeRazerReplyArguments(firmwareVersionReply, RazerCommands.getPollingRate))
      .toThrow(/does not answer/);
  });

  it("rejects a short reply", () => {
    expect(() => decodeRazerReplyArguments(firmwareVersionReply.slice(0, 64), RazerCommands.getFirmwareVersion))
      .toThrow(/64 bytes/);
  });
});

describe("isRazerReplyPending", () => {
  it("waits while the keyboard is busy", () => {
    expect(isRazerReplyPending(withStatus(firmwareVersionReply, 0x01), RazerCommands.getFirmwareVersion)).toBe(true);
  });

  it("waits while the buffer still holds the reply to an earlier command", () => {
    expect(isRazerReplyPending(firmwareVersionReply, RazerCommands.getPollingRate)).toBe(true);
  });

  it("stops waiting once the reply answers the command", () => {
    expect(isRazerReplyPending(firmwareVersionReply, RazerCommands.getFirmwareVersion)).toBe(false);
  });

  it("stops waiting for a final error status", () => {
    expect(isRazerReplyPending(pollingRateV2NotSupportedReply, pollingRateV2)).toBe(false);
  });
});

describe("decodeRazerFirmwareVersion", () => {
  it("formats major and minor version", () => {
    expect(decodeRazerFirmwareVersion(new Uint8Array([2, 3]))).toBe("2.3");
  });

  it("rejects a reply without both version bytes", () => {
    expect(() => decodeRazerFirmwareVersion(new Uint8Array([2]))).toThrow(RazerProtocolError);
  });
});
