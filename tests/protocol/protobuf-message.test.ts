import { describe, expect, it } from "vitest";
import { ProtobufDecodeError, ProtobufMessage } from "../../src/protocol/protobuf/protobuf-message";
import { keyboardProfilePayload, payloadOf, profileMetadataPayload } from "../fakes/wooting-80he-captures";

describe("ProtobufMessage", () => {
  it("reads a length-delimited field as text", () => {
    expect(ProtobufMessage.decode(profileMetadataPayload).string(1)).toBe("TenZ Profile");
  });

  it("reads multi-byte varints inside a nested message", () => {
    const profile = ProtobufMessage.decode(keyboardProfilePayload).message(1);

    expect([profile.varint(1), profile.varint(4)]).toEqual([0x4fd0, 0x4686]);
  });

  it("treats a missing varint field as zero like proto3 does", () => {
    expect(ProtobufMessage.decode(keyboardProfilePayload).message(1).varint(8)).toBe(0);
  });

  it("decodes varints wider than 32 bits without overflowing", () => {
    const message = ProtobufMessage.decode(payloadOf("0880808080808001"));

    expect(message.varint(1)).toBe(2 ** 42);
  });

  it("writes packed repeated varints as one length-delimited field", () => {
    const row = ProtobufMessage.empty().withPackedVarints(1, [0xf800, 0x001f]);

    expect([...row.encode()]).toEqual([0x0a, 0x04, 0x80, 0xf0, 0x03, 0x1f]);
    expect(row.repeatedVarints(1)).toEqual([0xf800, 0x1f]);
  });

  it("reads packed repeated varints", () => {
    const message = ProtobufMessage.decode(payloadOf("0a03017f02"));

    expect(message.repeatedVarints(1)).toEqual([1, 127, 2]);
  });

  it("reads repeated varints that are not packed", () => {
    const message = ProtobufMessage.decode(payloadOf("0801087f0802"));

    expect(message.repeatedVarints(1)).toEqual([1, 127, 2]);
  });

  it("returns every occurrence of a repeated message field", () => {
    const message = ProtobufMessage.decode(payloadOf("0a02080112020802"));

    expect(message.repeatedMessages(1).map((entry) => entry.varint(1))).toEqual([1]);
  });

  it("rejects a field that runs past the end of the message", () => {
    expect(() => ProtobufMessage.decode(payloadOf("0a05ab"))).toThrow(ProtobufDecodeError);
  });

  it("rejects field number zero", () => {
    expect(() => ProtobufMessage.decode(payloadOf("0001"))).toThrow(ProtobufDecodeError);
  });
});
