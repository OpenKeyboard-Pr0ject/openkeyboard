import { describe, expect, it } from "vitest";
import {
  ActiveSlotChangedError,
  EmptyProfileSlotError,
  ProfileWriteNotVerifiedError,
  WootingProfileEditor,
} from "../../src/drivers/wooting/wooting-profile-editor";
import { WootingProfileReader } from "../../src/drivers/wooting/wooting-profile-reader";
import { SettingOutOfRangeError } from "../../src/keyboard/keyboard-profile";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  actuationProfilePayload,
  emptyPayload,
  keyboardProfileCurrentPayload,
  keyMappingPayload,
  payloadOf,
  profileMetadataPayload,
  replyCarrying,
  typingProfileMetadataPayload,
  typingProfileSettingsPayload,
} from "../fakes/wooting-80he-captures";

const SETTINGS_REPORT_TYPE = 0x11;
const SAVE_BIT = 0x01;
const HEADER_BYTES = 6;
const SLOT_PARAMETER_INDEX = 3;

interface FakeKeyboardMemoryOptions {
  readonly keepsWrites?: boolean;
  readonly activeSlotAfterWrite?: number;
}

class FakeKeyboardMemory {
  activeSlot = 0;
  readonly settingsBySlot: Uint8Array[] = [keyboardProfileCurrentPayload, typingProfileSettingsPayload, emptyPayload];
  private readonly metadataBySlot = [profileMetadataPayload, typingProfileMetadataPayload, emptyPayload];

  constructor(private readonly options: FakeKeyboardMemoryOptions = {}) {}

  payloadFor(command: number, slot: number): Uint8Array {
    switch (command) {
      case WootingCommand.getCurrentProfileIndex:
        return Uint8Array.of(this.activeSlot, 0);
      case WootingCommand.getKeyboardProfile:
        return this.settingsBySlot[slot] ?? emptyPayload;
      case WootingCommand.getProfileMetadata:
        return this.metadataBySlot[slot] ?? emptyPayload;
      case WootingCommand.getKeyMapping:
        return slot === 0 ? keyMappingPayload : emptyPayload;
      case WootingCommand.getActuationProfile:
        return slot === 0 ? actuationProfilePayload : emptyPayload;
      default:
        return emptyPayload;
    }
  }

  receive(report: Uint8Array): void {
    const storage = report[3];
    if (report[2] !== SETTINGS_REPORT_TYPE || (storage & SAVE_BIT) === 0) return;
    if (this.options.activeSlotAfterWrite !== undefined) this.activeSlot = this.options.activeSlotAfterWrite;
    if (this.options.keepsWrites === false) return;
    const length = report[4] | (report[5] << 8);
    this.settingsBySlot[storage >> 1] = report.slice(HEADER_BYTES, HEADER_BYTES + length);
  }
}

function editorFor(memory: FakeKeyboardMemory): { editor: WootingProfileEditor; keyboard: FakeHidDevice } {
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => replyCarrying(data[2], memory.payloadFor(data[2], data[SLOT_PARAMETER_INDEX])),
    receiveOutputReport: (_reportId, data) => memory.receive(data),
  });
  const channel = new WootingCommandChannel(keyboard.asHidDevice());
  return { editor: new WootingProfileEditor(channel, new WootingProfileReader(channel)), keyboard };
}

describe("WootingProfileEditor on the active profile", () => {
  it("returns the profile read back after the write", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory());

    const profile = await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(profile.rapidTrigger.sensitivityMillimeters).toBe(0.5);
  });

  it("sends the update marker and then the settings report saved to slot 0, like Wootility", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(keyboard.sentOutputReports.map((report) => [...report.data.subarray(0, 4)])).toEqual([
      [0xd1, 0xda, 0x1d, 0x01],
      [0xd1, 0xda, 0x11, 0x01],
    ]);
  });

  it("writes on the smallest output report that holds the data, padded to its size", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { actuationMillimeters: 1.5 });

    expect(keyboard.sentOutputReports.map((report) => [report.reportId, report.data.length])).toEqual([[1, 32], [1, 32]]);
  });

  it("writes the exact bytes that were verified on the 80HE", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(keyboard.sentOutputReports[1].data.subarray(0, 28))
      .toEqual(payloadOf("d1da110116000a1408d09f0110011801208090012800300238004800"));
  });
});

describe("WootingProfileEditor on a profile that is not active", () => {
  it("writes the exact bytes Wootility saved to the Typing Profile in slot 1", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect(keyboard.sentOutputReports.map((report) => report.data.subarray(0, 28))).toEqual([
      payloadOf("d1da1d03000000000000000000000000000000000000000000000000"),
      payloadOf("d1da110316000a1408b2de011001180020e68c0128003002380148" + "00"),
    ]);
  });

  it("changes only the targeted slot", async () => {
    const memory = new FakeKeyboardMemory();
    const { editor } = editorFor(memory);

    await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect(memory.settingsBySlot[0]).toEqual(keyboardProfileCurrentPayload);
  });

  it("leaves the active profile where it was", async () => {
    const memory = new FakeKeyboardMemory();
    const { editor } = editorFor(memory);

    await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect(memory.activeSlot).toBe(0);
  });

  it("reads the edited profile back with its new value", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory());

    const profile = await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect([profile.name, profile.actuationMillimeters]).toEqual(["Typing Profile", 2.95]);
  });
});

describe("WootingProfileEditor safety checks", () => {
  it("reports a write that the keyboard did not keep", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory({ keepsWrites: false }));

    await expect(editor.updateProfile(0, { actuationMillimeters: 2 })).rejects.toBeInstanceOf(ProfileWriteNotVerifiedError);
  });

  it("reports when the active profile moved during the write", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory({ activeSlotAfterWrite: 1 }));

    await expect(editor.updateProfile(1, { actuationMillimeters: 2 })).rejects.toBeInstanceOf(ActiveSlotChangedError);
  });

  it("refuses to write into an empty slot", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await expect(editor.updateProfile(2, { actuationMillimeters: 2 })).rejects.toBeInstanceOf(EmptyProfileSlotError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });

  it.each([
    [{ actuationMillimeters: 0.05 }],
    [{ actuationMillimeters: 4.5 }],
    [{ actuationMillimeters: 1.23 }],
    [{ rapidTriggerSensitivityMillimeters: 2.4 }],
  ])("refuses %j before touching the keyboard", async (change) => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await expect(editor.updateProfile(0, change)).rejects.toBeInstanceOf(SettingOutOfRangeError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });
});
