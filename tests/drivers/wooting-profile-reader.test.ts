import { describe, expect, it } from "vitest";
import { WootingProfileReader } from "../../src/drivers/wooting/wooting-profile-reader";
import { keyLabel } from "../../src/keyboard/hid-key-names";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  actuationProfilePayload,
  currentProfileIndexPayload,
  emptyPayload,
  keyboardProfilePayload,
  keyMappingPayload,
  profileMetadataPayload,
  replyCarrying,
  typingProfileMetadataPayload,
  typingProfileSettingsPayload,
  ultraProfileActuationPayload,
  ultraProfileMetadataPayload,
  ultraProfileSettingsPayload,
} from "../fakes/wooting-80he-captures";

const PROFILE_SLOT_PARAMETER_INDEX = 3;

const payloadsBySlot: ReadonlyArray<ReadonlyMap<number, Uint8Array>> = [
  new Map([
    [WootingCommand.getProfileMetadata, profileMetadataPayload],
    [WootingCommand.getKeyboardProfile, keyboardProfilePayload],
    [WootingCommand.getActuationProfile, actuationProfilePayload],
  ]),
  new Map([
    [WootingCommand.getProfileMetadata, typingProfileMetadataPayload],
    [WootingCommand.getKeyboardProfile, typingProfileSettingsPayload],
    [WootingCommand.getActuationProfile, emptyPayload],
  ]),
  new Map([
    [WootingCommand.getProfileMetadata, ultraProfileMetadataPayload],
    [WootingCommand.getKeyboardProfile, ultraProfileSettingsPayload],
    [WootingCommand.getActuationProfile, ultraProfileActuationPayload],
  ]),
];

function payloadFor(command: number, slot: number): Uint8Array {
  if (command === WootingCommand.getCurrentProfileIndex) return currentProfileIndexPayload;
  if (command === WootingCommand.getKeyMapping) return slot === 0 ? keyMappingPayload : emptyPayload;
  return payloadsBySlot[slot]?.get(command) ?? emptyPayload;
}

function readerForTheUsers80he(): WootingProfileReader {
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => replyCarrying(data[2], payloadFor(data[2], data[PROFILE_SLOT_PARAMETER_INDEX])),
  });
  return new WootingProfileReader(new WootingCommandChannel(keyboard.asHidDevice()));
}

describe("WootingProfileReader", () => {
  it("reads which slot is active", async () => {
    await expect(readerForTheUsers80he().readActiveSlot()).resolves.toBe(0);
  });

  it("lists every stored profile and stops at the first empty slot", async () => {
    const profiles = await readerForTheUsers80he().listProfiles();

    expect(profiles).toEqual([
      { slot: 0, name: "TenZ Profile", color: "#ff2828" },
      { slot: 1, name: "Typing Profile", color: "#d00707" },
      { slot: 2, name: "TenZ Ultra Profile", color: "#ff2828" },
    ]);
  });

  it("reads the actuation point and Rapid Trigger of the TenZ profile", async () => {
    const profile = await readerForTheUsers80he().readProfile(0);

    expect(profile).toMatchObject({
      name: "TenZ Profile",
      actuationMillimeters: 1.0,
      rapidTrigger: { enabled: true, sensitivityMillimeters: 0.4, continuous: true },
    });
  });

  it("reads the typing profile with Rapid Trigger off and no per-key actuation", async () => {
    const profile = await readerForTheUsers80he().readProfile(1);

    expect(profile).toMatchObject({
      actuationMillimeters: 3.0,
      rapidTrigger: { enabled: false },
      keyActuations: [],
    });
  });

  it("reads the legacy 8-bit values of the TenZ Ultra profile", async () => {
    const profile = await readerForTheUsers80he().readProfile(2);

    expect({
      actuation: profile.actuationMillimeters,
      sensitivity: profile.rapidTrigger.sensitivityMillimeters,
      firstKeys: profile.keyActuations
        .slice(0, 2)
        .map((entry) => `${keyLabel(entry.key)}=${entry.actuationMillimeters}`),
    }).toEqual({ actuation: 1.0, sensitivity: 0.4, firstKeys: ["W=0.4", "A=0.4"] });
  });

  it("names every key of the TenZ profile that has its own actuation point", async () => {
    const profile = await readerForTheUsers80he().readProfile(0);

    const summary = profile.keyActuations.map((entry) => `${keyLabel(entry.key)}=${entry.actuationMillimeters}`);

    expect(summary).toEqual([
      "Esc=3", "Tab=3", "W=0.4", "Caps Lock=3", "A=0.4", "S=0.4", "D=0.4", "Left Ctrl=0.4", "Space=3",
    ]);
  });
});
