import { describe, expect, it } from "vitest";
import { WootingLightingReader } from "../../src/drivers/wooting/wooting-lighting-reader";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  currentProfileIndexPayload,
  emptyPayload,
  payloadOf,
  profileMetadataPayload,
  replyCarrying,
  tenzRgbCorePayload,
  tenzRgbRowsPayload,
  tenzTachyonProfileSettingsPayload,
  typingRgbCorePayload,
} from "../fakes/wooting-80he-captures";

const PROFILE_SLOT_PARAMETER_INDEX = 3;

const TENZ_PROFILE_PAYLOADS: ReadonlyMap<number, Uint8Array> = new Map([
  [WootingCommand.getCurrentProfileIndex, currentProfileIndexPayload],
  [WootingCommand.getProfileMetadata, profileMetadataPayload],
  [WootingCommand.getRgbCore, tenzRgbCorePayload],
  [WootingCommand.getRgbUpperRows, tenzRgbRowsPayload],
  [WootingCommand.getRgbLowerRows, tenzRgbRowsPayload],
]);

function readerWithRequests(corePayload = tenzRgbCorePayload, settingsPayload = emptyPayload) {
  const requests: Array<readonly [number, number]> = [];
  const payloads = new Map(TENZ_PROFILE_PAYLOADS)
    .set(WootingCommand.getRgbCore, corePayload)
    .set(WootingCommand.getKeyboardProfile, settingsPayload);
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => {
      requests.push([data[2], data[PROFILE_SLOT_PARAMETER_INDEX]]);
      return replyCarrying(data[2], payloads.get(data[2]) ?? emptyPayload);
    },
  });
  return { reader: new WootingLightingReader(new WootingCommandChannel(keyboard.asHidDevice())), requests };
}

describe("WootingLightingReader", () => {
  it("reads the per-key colors and brightness of the active profile", async () => {
    const { reader } = readerWithRequests();

    const lighting = await reader.readLighting();

    expect(lighting.brightnessPercent).toBe(70);
    expect(lighting.effect).toEqual({ kind: "per-key" });
    expect(lighting.effectHidesKeyColors).toBe(false);
    expect(lighting.profileName).toBe("TenZ Profile");
    expect(lighting.profileSlot).toBe(0);
    expect(lighting.keyColors).toHaveLength(126);
    expect(lighting.keyColors?.find((key) => key.matrixRow === 5 && key.matrixColumn === 20)?.color)
      .toEqual({ red: 255, green: 239, blue: 0 });
  });

  it("warns that an animated base effect covers the key colors", async () => {
    const { reader } = readerWithRequests(typingRgbCorePayload);

    const lighting = await reader.readLighting();

    expect(lighting.effectHidesKeyColors).toBe(true);
    expect(lighting.effect).toEqual({ kind: "layered", description: "Wave" });
    expect(lighting.layeredEffects).toEqual({
      base: { effectId: "wave", values: { look: 0, speed: 16, direction: 0 } },
      effectLayers: [],
    });
  });

  it("shows key colors under effect layers when the base effect is Static", async () => {
    const { reader } = readerWithRequests(payloadOf("0a0b08ff0110ffff0318ffff0322070a055a03088c01"));

    const lighting = await reader.readLighting();

    expect(lighting.effectHidesKeyColors).toBe(false);
    expect(lighting.effect).toEqual({ kind: "layered", description: "Static with RT display" });
  });

  it("reports that Tachyon Mode turns the effects off", async () => {
    expect((await readerWithRequests().reader.readLighting()).effectsDisabledBy).toBeUndefined();

    const { reader } = readerWithRequests(tenzRgbCorePayload, tenzTachyonProfileSettingsPayload);
    const lighting = await reader.readLighting();

    expect(lighting.effectsDisabledBy).toBe("tachyon-mode");
  });

  it("sends only read commands, each for the active slot", async () => {
    const { reader, requests } = readerWithRequests();

    await reader.readLighting();

    expect(requests).toEqual([
      [WootingCommand.getCurrentProfileIndex, 0],
      [WootingCommand.getProfileMetadata, 0],
      [WootingCommand.getKeyboardProfile, 0],
      [WootingCommand.getRgbCore, 0],
      [WootingCommand.getRgbUpperRows, 0],
      [WootingCommand.getRgbLowerRows, 0],
    ]);
  });
});
