import { describe, expect, it } from "vitest";
import { decodeRazerReplyArguments, RazerProtocolError } from "../../src/protocol/razer/razer-codec";
import { RazerCommands } from "../../src/protocol/razer/razer-constants";
import {
  decodeBatteryLevelPercent,
  decodeCharging,
  decodeIdleTimeSeconds,
  decodePollingRateHz,
  encodeIdleTimeArguments,
  encodePollingRateArguments,
} from "../../src/protocol/razer/razer-device-codec";
import {
  batteryLevelReply,
  chargingStatusReply,
  idleTimeReply,
  pollingRateReply,
} from "../fakes/razer-blackwidow-v3-mini-captures";

describe("Razer device settings codec", () => {
  it("reads the captured polling rate as 1000 Hz", () => {
    const replyArguments = decodeRazerReplyArguments(pollingRateReply, RazerCommands.getPollingRate);

    expect(decodePollingRateHz(replyArguments)).toBe(1000);
  });

  it.each([[1000, 0x01], [500, 0x02], [125, 0x08]])("writes %i Hz as code %i", (pollingRateHz, code) => {
    expect(encodePollingRateArguments(pollingRateHz)).toEqual([code]);
  });

  it("refuses a polling rate the protocol cannot express", () => {
    expect(() => encodePollingRateArguments(250)).toThrow(RazerProtocolError);
  });

  it("refuses an unknown polling rate code", () => {
    expect(() => decodePollingRateHz(new Uint8Array([0x04]))).toThrow(/0x04/);
  });

  it("reads the captured battery level 0xFF as 100 %", () => {
    const replyArguments = decodeRazerReplyArguments(batteryLevelReply, RazerCommands.getBatteryLevel);

    expect(decodeBatteryLevelPercent(replyArguments)).toBe(100);
  });

  it("scales a partial battery level to percent", () => {
    expect(decodeBatteryLevelPercent(new Uint8Array([0x00, 0x80]))).toBe(50);
  });

  it("reads the captured charging status as charging", () => {
    const replyArguments = decodeRazerReplyArguments(chargingStatusReply, RazerCommands.getChargingStatus);

    expect(decodeCharging(replyArguments)).toBe(true);
  });

  it("reads a zero charging status as not charging", () => {
    expect(decodeCharging(new Uint8Array([0x00, 0x00]))).toBe(false);
  });

  it("reads the captured idle time as 900 seconds", () => {
    const replyArguments = decodeRazerReplyArguments(idleTimeReply, RazerCommands.getIdleTime);

    expect(decodeIdleTimeSeconds(replyArguments)).toBe(900);
  });

  it("writes the idle time big-endian", () => {
    expect(encodeIdleTimeArguments(600)).toEqual([0x02, 0x58]);
  });

  it("rejects short replies", () => {
    expect(() => decodeIdleTimeSeconds(new Uint8Array([0x03]))).toThrow(RazerProtocolError);
    expect(() => decodeBatteryLevelPercent(new Uint8Array([0x00]))).toThrow(RazerProtocolError);
    expect(() => decodeCharging(new Uint8Array([0x00]))).toThrow(RazerProtocolError);
  });
});
