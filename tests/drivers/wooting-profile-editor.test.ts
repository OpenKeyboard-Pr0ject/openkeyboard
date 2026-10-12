import { describe, expect, it } from "vitest";
import { ProfileWriteNotVerifiedError, WootingProfileEditor } from "../../src/drivers/wooting/wooting-profile-editor";
import { WootingProfileReader } from "../../src/drivers/wooting/wooting-profile-reader";
import { SettingOutOfRangeError } from "../../src/keyboard/keyboard-profile";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  actuationProfilePayload,
  currentProfileIndexPayload,
  emptyPayload,
  keyboardProfileCurrentPayload,
  keyMappingPayload,
  payloadOf,
  profileMetadataPayload,
  replyCarrying,
} from "../fakes/wooting-80he-captures";

const SETTINGS_REPORT_TYPE = 0x11;
const SAVED_STORAGE = 0x01;
const HEADER_BYTES = 6;

class FakeKeyboardMemory {
  settings = keyboardProfileCurrentPayload;

  constructor(private readonly keepsWrites: boolean) {}

  payloadFor(command: number): Uint8Array {
    const payloads = new Map<number, Uint8Array>([
      [WootingCommand.getCurrentProfileIndex, currentProfileIndexPayload],
      [WootingCommand.getKeyboardProfile, this.settings],
      [WootingCommand.getProfileMetadata, profileMetadataPayload],
      [WootingCommand.getKeyMapping, keyMappingPayload],
      [WootingCommand.getActuationProfile, actuationProfilePayload],
    ]);
    return payloads.get(command) ?? emptyPayload;
  }

  receive(report: Uint8Array): void {
    if (!this.keepsWrites || report[2] !== SETTINGS_REPORT_TYPE || report[3] !== SAVED_STORAGE) return;
    const length = report[4] | (report[5] << 8);
    this.settings = report.slice(HEADER_BYTES, HEADER_BYTES + length);
  }
}

function editorFor(memory: FakeKeyboardMemory): { editor: WootingProfileEditor; keyboard: FakeHidDevice } {
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => replyCarrying(data[2], memory.payloadFor(data[2])),
    receiveOutputReport: (_reportId, data) => memory.receive(data),
  });
  const channel = new WootingCommandChannel(keyboard.asHidDevice());
  return { editor: new WootingProfileEditor(channel, new WootingProfileReader(channel)), keyboard };
}

describe("WootingProfileEditor", () => {
  it("returns the profile read back after the write", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory(true));

    const profile = await editor.updateActiveProfile({ rapidTriggerSensitivityMillimeters: 0.5 });

    expect(profile.rapidTrigger.sensitivityMillimeters).toBe(0.5);
  });

  it("sends the update marker and then the saved settings report, like Wootility", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory(true));

    await editor.updateActiveProfile({ rapidTriggerSensitivityMillimeters: 0.5 });

    expect(keyboard.sentOutputReports.map((report) => [...report.data.subarray(0, 4)])).toEqual([
      [0xd1, 0xda, 0x1d, 0x01],
      [0xd1, 0xda, 0x11, 0x01],
    ]);
  });

  it("writes on the smallest output report that holds the data, padded to its size", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory(true));

    await editor.updateActiveProfile({ actuationMillimeters: 1.5 });

    expect(keyboard.sentOutputReports.map((report) => [report.reportId, report.data.length])).toEqual([[1, 32], [1, 32]]);
  });

  it("writes the exact bytes that were verified on the 80HE", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory(true));

    await editor.updateActiveProfile({ rapidTriggerSensitivityMillimeters: 0.5 });

    expect(keyboard.sentOutputReports[1].data.subarray(0, 28))
      .toEqual(payloadOf("d1da110116000a1408d09f0110011801208090012800300238004800"));
  });

  it("reports a write that the keyboard did not keep", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory(false));

    await expect(editor.updateActiveProfile({ actuationMillimeters: 2 })).rejects.toBeInstanceOf(ProfileWriteNotVerifiedError);
  });

  it.each([
    [{ actuationMillimeters: 0.05 }],
    [{ actuationMillimeters: 4.5 }],
    [{ actuationMillimeters: 1.23 }],
    [{ rapidTriggerSensitivityMillimeters: 2.4 }],
  ])("refuses %j before touching the keyboard", async (change) => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory(true));

    await expect(editor.updateActiveProfile(change)).rejects.toBeInstanceOf(SettingOutOfRangeError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });
});
