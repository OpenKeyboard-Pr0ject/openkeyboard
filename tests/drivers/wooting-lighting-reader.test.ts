import { describe, expect, it } from "vitest";
import { WootingLightingReader } from "../../src/drivers/wooting/wooting-lighting-reader";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  currentProfileIndexPayload,
  emptyPayload,
  profileMetadataPayload,
  replyCarrying,
  tenzRgbCorePayload,
  tenzRgbRowsPayload,
} from "../fakes/wooting-80he-captures";

const PROFILE_SLOT_PARAMETER_INDEX = 3;

const TENZ_PROFILE_PAYLOADS: ReadonlyMap<number, Uint8Array> = new Map([
  [WootingCommand.getCurrentProfileIndex, currentProfileIndexPayload],
  [WootingCommand.getProfileMetadata, profileMetadataPayload],
  [WootingCommand.getRgbCore, tenzRgbCorePayload],
  [WootingCommand.getRgbUpperRows, tenzRgbRowsPayload],
  [WootingCommand.getRgbLowerRows, tenzRgbRowsPayload],
]);

function readerWithRequests() {
  const requests: Array<readonly [number, number]> = [];
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => {
      requests.push([data[2], data[PROFILE_SLOT_PARAMETER_INDEX]]);
      return replyCarrying(data[2], TENZ_PROFILE_PAYLOADS.get(data[2]) ?? emptyPayload);
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
    expect(lighting.profileName).toBe("TenZ Profile");
    expect(lighting.keyColors).toHaveLength(126);
    expect(lighting.keyColors?.find((key) => key.matrixRow === 5 && key.matrixColumn === 20)?.color)
      .toEqual({ red: 255, green: 239, blue: 0 });
  });

  it("sends only read commands, each for the active slot", async () => {
    const { reader, requests } = readerWithRequests();

    await reader.readLighting();

    expect(requests).toEqual([
      [WootingCommand.getCurrentProfileIndex, 0],
      [WootingCommand.getProfileMetadata, 0],
      [WootingCommand.getRgbCore, 0],
      [WootingCommand.getRgbUpperRows, 0],
      [WootingCommand.getRgbLowerRows, 0],
    ]);
  });
});
