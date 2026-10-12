import {
  assertWithinRange,
  type KeyboardProfile,
  type KeyboardProfileEditor,
  type ProfileSettingsChange,
} from "../../keyboard/keyboard-profile";
import { encodeWootingReport, storageForSavingToSlot } from "../../protocol/wooting/wooting-codec";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  ACTUATION_POINT_RANGE,
  RAPID_TRIGGER_SENSITIVITY_RANGE,
  WootingCommand,
  WootingReportType,
} from "../../protocol/wooting/wooting-constants";
import {
  applyProfileSettingsChange,
  decodeProfileSettings,
  millimetersToPreciseTravel,
  type WootingProfileSettings,
  type WootingProfileSettingsChange,
} from "../../protocol/wooting/wooting-profile-codec";
import type { WootingProfileReader } from "./wooting-profile-reader";

export class ProfileWriteNotVerifiedError extends Error {
  constructor(fieldNames: readonly string[]) {
    super(`The keyboard did not keep the new ${fieldNames.join(", ")}. Nothing else was changed.`);
    this.name = "ProfileWriteNotVerifiedError";
  }
}

export class EmptyProfileSlotError extends Error {
  constructor(slot: number) {
    super(`Profile slot ${slot + 1} is empty, so there are no settings to change.`);
    this.name = "EmptyProfileSlotError";
  }
}

export class ActiveSlotChangedError extends Error {
  constructor(before: number, after: number) {
    super(`The active profile moved from slot ${before + 1} to slot ${after + 1} during the write.`);
    this.name = "ActiveSlotChangedError";
  }
}

export class WootingProfileEditor implements KeyboardProfileEditor {
  readonly actuationRange = ACTUATION_POINT_RANGE;
  readonly rapidTriggerSensitivityRange = RAPID_TRIGGER_SENSITIVITY_RANGE;

  constructor(
    private readonly commands: WootingCommandChannel,
    private readonly reader: WootingProfileReader,
  ) {}

  async updateProfile(slot: number, change: ProfileSettingsChange): Promise<KeyboardProfile> {
    this.validate(change);
    const storage = storageForSavingToSlot(slot);
    const rawChange = toRawChange(change);
    const currentSettings = await this.commands.request(WootingCommand.getKeyboardProfile, [slot]);
    if (currentSettings.length === 0) throw new EmptyProfileSlotError(slot);
    const activeSlotBefore = await this.reader.readActiveSlot();
    await this.commands.writeReport(encodeWootingReport(WootingReportType.settingsUpdateMarker, storage));
    await this.commands.writeReport(encodeWootingReport(
      WootingReportType.keyboardProfileSettings,
      storage,
      applyProfileSettingsChange(currentSettings, rawChange),
    ));
    await this.verifyStored(slot, rawChange);
    await this.verifyActiveSlotUnchanged(activeSlotBefore);
    return this.reader.readProfile(slot);
  }

  private async verifyActiveSlotUnchanged(activeSlotBefore: number): Promise<void> {
    const activeSlotAfter = await this.reader.readActiveSlot();
    if (activeSlotAfter !== activeSlotBefore) throw new ActiveSlotChangedError(activeSlotBefore, activeSlotAfter);
  }

  private validate(change: ProfileSettingsChange): void {
    if (change.actuationMillimeters !== undefined) {
      assertWithinRange("Actuation point", change.actuationMillimeters, this.actuationRange);
    }
    if (change.rapidTriggerSensitivityMillimeters !== undefined) {
      assertWithinRange("Rapid Trigger sensitivity", change.rapidTriggerSensitivityMillimeters, this.rapidTriggerSensitivityRange);
    }
  }

  private async verifyStored(slot: number, rawChange: WootingProfileSettingsChange): Promise<void> {
    const stored = decodeProfileSettings(await this.commands.request(WootingCommand.getKeyboardProfile, [slot]));
    const mismatched = (Object.keys(rawChange) as Array<keyof WootingProfileSettings>)
      .filter((field) => stored[field] !== rawChange[field]);
    if (mismatched.length > 0) throw new ProfileWriteNotVerifiedError(mismatched);
  }
}

function toRawChange(change: ProfileSettingsChange): WootingProfileSettingsChange {
  return {
    ...(change.actuationMillimeters !== undefined
      ? { actuationRaw: millimetersToPreciseTravel(change.actuationMillimeters) } : {}),
    ...(change.rapidTriggerEnabled !== undefined ? { rapidTriggerEnabled: change.rapidTriggerEnabled } : {}),
    ...(change.rapidTriggerSensitivityMillimeters !== undefined
      ? { rapidTriggerSensitivityRaw: millimetersToPreciseTravel(change.rapidTriggerSensitivityMillimeters) } : {}),
    ...(change.continuousRapidTrigger !== undefined ? { continuousRapidTriggerEnabled: change.continuousRapidTrigger } : {}),
  };
}
