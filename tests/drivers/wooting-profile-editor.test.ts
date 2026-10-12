import { describe, expect, it } from "vitest";
import {
  ActiveSlotChangedError,
  EmptyProfileSlotError,
  ProfileWriteNotVerifiedError,
  WootingProfileEditor,
} from "../../src/drivers/wooting/wooting-profile-editor";
import { WootingProfileReader } from "../../src/drivers/wooting/wooting-profile-reader";
import { SettingOutOfRangeError } from "../../src/keyboard/keyboard-profile";
import type { MatrixKey } from "../../src/keyboard/matrix-key";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { LegacyPerKeyActuationError } from "../../src/protocol/wooting/wooting-per-key-codec";
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
  typingQAndWRapidTriggerReadPayload,
  typingQKeyActuationReadPayload,
  typingSettingsWithQSensitivityPayload,
  ultraProfileActuationPayload,
  ultraProfileMetadataPayload,
  ultraProfileSettingsPayload,
} from "../fakes/wooting-80he-captures";

const HEADER_WITHOUT_LENGTH_BYTES = 4;
const HEADER_BYTES = 6;
const SLOT_PARAMETER_INDEX = 3;
const SAVE_BIT = 0x01;
const Q_KEY: MatrixKey = { hidUsage: 0x14, matrixRow: 2, matrixColumn: 1 };
const W_KEY: MatrixKey = { hidUsage: 0x1a, matrixRow: 2, matrixColumn: 2 };

const READ_COMMAND_BY_REPORT = new Map<number, number>([
  [0x11, WootingCommand.getKeyboardProfile],
  [0x15, WootingCommand.getActuationProfile],
  [0x1d, WootingCommand.getPerKeyRapidTrigger],
]);

interface FakeKeyboardMemoryOptions {
  readonly keepsWrites?: boolean;
  readonly activeSlotAfterWrite?: number;
}

class FakeKeyboardMemory {
  activeSlot = 0;
  readonly stored = new Map<string, Uint8Array>([
    [this.key(WootingCommand.getKeyboardProfile, 0), keyboardProfileCurrentPayload],
    [this.key(WootingCommand.getActuationProfile, 0), actuationProfilePayload],
    [this.key(WootingCommand.getProfileMetadata, 0), profileMetadataPayload],
    [this.key(WootingCommand.getKeyMapping, 0), keyMappingPayload],
    [this.key(WootingCommand.getKeyboardProfile, 1), typingProfileSettingsPayload],
    [this.key(WootingCommand.getProfileMetadata, 1), typingProfileMetadataPayload],
    [this.key(WootingCommand.getKeyboardProfile, 2), ultraProfileSettingsPayload],
    [this.key(WootingCommand.getActuationProfile, 2), ultraProfileActuationPayload],
    [this.key(WootingCommand.getProfileMetadata, 2), ultraProfileMetadataPayload],
  ]);

  constructor(private readonly options: FakeKeyboardMemoryOptions = {}) {}

  payloadFor(command: number, slot: number): Uint8Array {
    if (command === WootingCommand.getCurrentProfileIndex) return Uint8Array.of(this.activeSlot, 0);
    return this.stored.get(this.key(command, slot)) ?? emptyPayload;
  }

  storedPayload(command: number, slot: number): Uint8Array {
    return this.payloadFor(command, slot);
  }

  receive(report: Uint8Array): void {
    const readCommand = READ_COMMAND_BY_REPORT.get(report[2]);
    const storage = report[3];
    if (readCommand === undefined || (storage & SAVE_BIT) === 0) return;
    if (this.options.activeSlotAfterWrite !== undefined) this.activeSlot = this.options.activeSlotAfterWrite;
    if (this.options.keepsWrites === false) return;
    this.stored.set(this.key(readCommand, storage >> 1), payloadOfReport(report));
  }

  private key(command: number, slot: number): string {
    return `${command}:${slot}`;
  }
}

function payloadOfReport(report: Uint8Array): Uint8Array {
  const isHeaderOnly = report.subarray(HEADER_WITHOUT_LENGTH_BYTES).every((byte) => byte === 0);
  if (isHeaderOnly) return emptyPayload;
  const length = report[4] | (report[5] << 8);
  return report.slice(HEADER_BYTES, HEADER_BYTES + length);
}

function editorFor(memory: FakeKeyboardMemory): { editor: WootingProfileEditor; keyboard: FakeHidDevice } {
  const keyboard = new FakeHidDevice({
    respond: (_reportId, data) => replyCarrying(data[2], memory.payloadFor(data[2], data[SLOT_PARAMETER_INDEX])),
    receiveOutputReport: (_reportId, data) => memory.receive(data),
  });
  const channel = new WootingCommandChannel(keyboard.asHidDevice());
  return { editor: new WootingProfileEditor(channel, new WootingProfileReader(channel)), keyboard };
}

function sentHeaders(keyboard: FakeHidDevice): number[][] {
  return keyboard.sentOutputReports.map((report) => [...report.data.subarray(0, 4)]);
}

describe("WootingProfileEditor profile settings", () => {
  it("returns the profile read back after the write", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory());

    const profile = await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(profile.rapidTrigger.sensitivityMillimeters).toBe(0.5);
  });

  it("sends only the settings report, so per-key Rapid Trigger is never cleared by accident", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(sentHeaders(keyboard)).toEqual([[0xd1, 0xda, 0x11, 0x01]]);
  });

  it("writes on the smallest output report that holds the data, padded to its size", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { actuationMillimeters: 1.5 });

    expect(keyboard.sentOutputReports.map((report) => [report.reportId, report.data.length])).toEqual([[1, 32]]);
  });

  it("writes the exact bytes that were verified on the 80HE", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(0, { rapidTriggerSensitivityMillimeters: 0.5 });

    expect(keyboard.sentOutputReports[0].data.subarray(0, 28))
      .toEqual(payloadOf("d1da110116000a1408d09f0110011801208090012800300238004800"));
  });

  it("writes the exact bytes Wootility saved to the Typing Profile in slot 1", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect(keyboard.sentOutputReports[0].data.subarray(0, 28))
      .toEqual(payloadOf("d1da110316000a1408b2de011001180020e68c012800300238014800"));
  });

  it("changes only the targeted slot and leaves the active profile alone", async () => {
    const memory = new FakeKeyboardMemory();
    const { editor } = editorFor(memory);

    await editor.updateProfile(1, { actuationMillimeters: 2.95 });

    expect([memory.storedPayload(WootingCommand.getKeyboardProfile, 0), memory.activeSlot])
      .toEqual([keyboardProfileCurrentPayload, 0]);
  });
});

describe("WootingProfileEditor per-key settings", () => {
  it("writes the per-key Rapid Trigger report Wootility sent for Q", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(1, { keys: [{ key: Q_KEY, rapidTrigger: { kind: "profile-sensitivity" } }] });

    expect(keyboard.sentOutputReports[0].data.subarray(0, 12)).toEqual(payloadOf("d1da1d0306000a0408411801"));
  });

  it("writes the per-key actuation report Wootility sent for Q at 1.50 mm", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(1, { keys: [{ key: Q_KEY, actuation: { kind: "custom", millimeters: 1.5 } }] });

    expect(keyboard.sentOutputReports[0].data.subarray(0, 14)).toEqual(payloadOf("d1da15030800220608c18080c005"));
  });

  it("writes per-key Rapid Trigger, then settings, then per-key actuation, like Wootility", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await editor.updateProfile(1, {
      rapidTriggerSensitivityMillimeters: 0.3,
      keys: [{
        key: Q_KEY,
        actuation: { kind: "custom", millimeters: 1.5 },
        rapidTrigger: { kind: "profile-sensitivity" },
      }],
    });

    expect(sentHeaders(keyboard).map((header) => header[2])).toEqual([0x1d, 0x11, 0x15]);
  });

  it("reproduces the state Wootility saved for Q and W in the Typing Profile", async () => {
    const memory = new FakeKeyboardMemory();
    const { editor } = editorFor(memory);

    const profile = await editor.updateProfile(1, {
      rapidTriggerSensitivityMillimeters: 0.3,
      keys: [
        { key: Q_KEY, actuation: { kind: "custom", millimeters: 1.5 }, rapidTrigger: { kind: "profile-sensitivity" } },
        { key: W_KEY, rapidTrigger: { kind: "custom", sensitivityMillimeters: 0.6 } },
      ],
    });

    expect({
      settings: memory.storedPayload(WootingCommand.getKeyboardProfile, 1),
      keyRapidTriggers: profile.keyRapidTriggers.map((entry) => [entry.key.matrixColumn, entry.sensitivityMillimeters]),
      keyActuations: profile.keyActuations.map((entry) => [entry.key.matrixColumn, entry.actuationMillimeters]),
    }).toEqual({
      settings: typingSettingsWithQSensitivityPayload,
      keyRapidTriggers: [[1, 0.3], [2, 0.6]],
      keyActuations: [[1, 1.5]],
    });
  });

  it("restores the original Typing Profile from the state Wootility left", async () => {
    const memory = new FakeKeyboardMemory();
    memory.stored.set(`${WootingCommand.getKeyboardProfile}:1`, typingSettingsWithQSensitivityPayload);
    memory.stored.set(`${WootingCommand.getActuationProfile}:1`, typingQKeyActuationReadPayload);
    memory.stored.set(`${WootingCommand.getPerKeyRapidTrigger}:1`, typingQAndWRapidTriggerReadPayload);
    const { editor } = editorFor(memory);

    await editor.updateProfile(1, {
      rapidTriggerSensitivityMillimeters: 0.4,
      keys: [
        { key: Q_KEY, actuation: { kind: "follow-profile" }, rapidTrigger: { kind: "follow-profile" } },
        { key: W_KEY, rapidTrigger: { kind: "follow-profile" } },
      ],
    });

    expect([
      memory.storedPayload(WootingCommand.getKeyboardProfile, 1),
      memory.storedPayload(WootingCommand.getActuationProfile, 1),
      memory.storedPayload(WootingCommand.getPerKeyRapidTrigger, 1),
    ]).toEqual([typingProfileSettingsPayload, emptyPayload, emptyPayload]);
  });

  it("refuses per-key actuation on a profile that still uses the 8-bit list", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    const update = editor.updateProfile(2, { keys: [{ key: Q_KEY, actuation: { kind: "custom", millimeters: 1.5 } }] });

    await expect(update).rejects.toBeInstanceOf(LegacyPerKeyActuationError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });
});

describe("WootingProfileEditor safety checks", () => {
  it("reports a write that the keyboard did not keep", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory({ keepsWrites: false }));

    const update = editor.updateProfile(0, { actuationMillimeters: 2 });

    await expect(update).rejects.toBeInstanceOf(ProfileWriteNotVerifiedError);
  });

  it("names the per-key part that the keyboard did not keep", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory({ keepsWrites: false }));

    const update = editor.updateProfile(1, { keys: [{ key: Q_KEY, rapidTrigger: { kind: "profile-sensitivity" } }] });

    await expect(update).rejects.toThrow("per-key Rapid Trigger");
  });

  it("reports when the active profile moved during the write", async () => {
    const { editor } = editorFor(new FakeKeyboardMemory({ activeSlotAfterWrite: 1 }));

    await expect(editor.updateProfile(1, { actuationMillimeters: 2 })).rejects.toBeInstanceOf(ActiveSlotChangedError);
  });

  it("refuses to write into an empty slot", async () => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await expect(editor.updateProfile(3, { actuationMillimeters: 2 })).rejects.toBeInstanceOf(EmptyProfileSlotError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });

  it.each([
    [{ actuationMillimeters: 0.05 }],
    [{ actuationMillimeters: 4.5 }],
    [{ actuationMillimeters: 1.23 }],
    [{ rapidTriggerSensitivityMillimeters: 2.4 }],
    [{ keys: [{ key: Q_KEY, actuation: { kind: "custom" as const, millimeters: 4.2 } }] }],
    [{ keys: [{ key: Q_KEY, rapidTrigger: { kind: "custom" as const, sensitivityMillimeters: 0.03 } }] }],
  ])("refuses %j before touching the keyboard", async (change) => {
    const { editor, keyboard } = editorFor(new FakeKeyboardMemory());

    await expect(editor.updateProfile(0, change)).rejects.toBeInstanceOf(SettingOutOfRangeError);
    expect(keyboard.sentOutputReports).toHaveLength(0);
  });
});
