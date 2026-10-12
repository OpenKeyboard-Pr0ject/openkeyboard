import { describe, expect, it } from "vitest";
import { WootingProfileReader } from "../../src/drivers/wooting/wooting-profile-reader";
import { keyLabel } from "../../src/keyboard/hid-key-names";
import type { KeyboardProfile } from "../../src/keyboard/keyboard-profile";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  actuationProfilePayload,
  currentProfileIndexPayload,
  keyboardProfilePayload,
  keyMappingPayload,
  profileMetadataPayload,
  replyCarrying,
} from "../fakes/wooting-80he-captures";

const payloadsByCommand = new Map<number, Uint8Array>([
  [WootingCommand.getCurrentProfileIndex, currentProfileIndexPayload],
  [WootingCommand.getProfileMetadata, profileMetadataPayload],
  [WootingCommand.getKeyboardProfile, keyboardProfilePayload],
  [WootingCommand.getKeyMapping, keyMappingPayload],
  [WootingCommand.getActuationProfile, actuationProfilePayload],
]);

function tenZProfileKeyboard(): FakeHidDevice {
  return new FakeHidDevice({
    respond: (_reportId, data) => {
      const payload = payloadsByCommand.get(data[2]);
      return payload ? replyCarrying(data[2], payload) : undefined;
    },
  });
}

async function readTenZProfile(): Promise<KeyboardProfile> {
  const channel = new WootingCommandChannel(tenZProfileKeyboard().asHidDevice());
  return new WootingProfileReader(channel).readActiveProfile();
}

describe("WootingProfileReader", () => {
  it("reads the name, color, slot and actuation point of the active profile", async () => {
    const profile = await readTenZProfile();

    expect(profile).toMatchObject({ slot: 0, name: "TenZ Profile", color: "#ff2828", actuationMillimeters: 1.0 });
  });

  it("reads the Rapid Trigger settings of the active profile", async () => {
    const profile = await readTenZProfile();

    expect(profile.rapidTrigger).toEqual({ enabled: true, sensitivityMillimeters: 0.4, continuous: true });
  });

  it("names every key that has its own actuation point", async () => {
    const profile = await readTenZProfile();

    const summary = profile.keyActuations.map((entry) => `${keyLabel(entry.key)}=${entry.actuationMillimeters}`);

    expect(summary).toEqual([
      "Esc=3", "Tab=3", "W=0.4", "Caps Lock=3", "A=0.4", "S=0.4", "D=0.4", "Left Ctrl=0.4", "Space=3",
    ]);
  });
});
