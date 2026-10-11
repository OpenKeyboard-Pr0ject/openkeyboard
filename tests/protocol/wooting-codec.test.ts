import { describe, expect, it } from "vitest";
import {
  decodeFirmwareVersion,
  decodeWootingReplyPayload,
  encodeWootingCommand,
  isWootingReplyTo,
  WootingProtocolError,
} from "../../src/protocol/wooting/wooting-codec";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { firmwareVersionReply, rejectedCommandReply } from "../fakes/wooting-80he-captures";

describe("encodeWootingCommand", () => {
  it("starts with the command magic followed by the command id", () => {
    const command = encodeWootingCommand(WootingCommand.getFirmwareVersion, 0);

    expect([...command]).toEqual([0xd1, 0xda, 0x01, 0, 0, 0, 0]);
  });

  it("pads the command to the declared feature report length", () => {
    const command = encodeWootingCommand(WootingCommand.getFirmwareVersion, 64);

    expect(command.length).toBe(64);
  });
});

describe("isWootingReplyTo", () => {
  it("matches a reply that echoes the command id", () => {
    expect(isWootingReplyTo(firmwareVersionReply, WootingCommand.getFirmwareVersion)).toBe(true);
  });

  it("ignores reports that do not carry the command magic", () => {
    expect(isWootingReplyTo(new Uint8Array(64), WootingCommand.getFirmwareVersion)).toBe(false);
  });
});

describe("decodeWootingReplyPayload", () => {
  it("returns the payload sized by the length field of a captured 80HE reply", () => {
    expect([...decodeWootingReplyPayload(firmwareVersionReply)]).toEqual([0x02, 0x0e, 0x00]);
  });

  it("rejects a reply whose status is not success", () => {
    expect(() => decodeWootingReplyPayload(rejectedCommandReply)).toThrow(/status 0xFF/);
  });

  it("rejects a reply that declares more payload than it carries", () => {
    const truncated = firmwareVersionReply.slice(0, 7);

    expect(() => decodeWootingReplyPayload(truncated)).toThrow(WootingProtocolError);
  });
});

describe("decodeFirmwareVersion", () => {
  it("formats major, minor and patch bytes as a dotted version", () => {
    expect(decodeFirmwareVersion(new Uint8Array([0x02, 0x0e, 0x00]))).toBe("2.14.0");
  });

  it("rejects a payload shorter than three bytes", () => {
    expect(() => decodeFirmwareVersion(new Uint8Array([0x02]))).toThrow(WootingProtocolError);
  });
});
