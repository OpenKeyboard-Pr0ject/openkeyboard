import {
  assertWithinRange,
  type KeyboardProfile,
  type KeyboardProfileEditor,
  type ProfileSettingsChange,
} from "../../keyboard/keyboard-profile";
import { encodeWootingReport } from "../../protocol/wooting/wooting-codec";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  ACTUATION_POINT_RANGE,
  RAPID_TRIGGER_SENSITIVITY_RANGE,
  WootingCommand,
  WootingReportStorage,
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

export class WootingProfileEditor implements KeyboardProfileEditor {
  readonly actuationRange = ACTUATION_POINT_RANGE;
  readonly rapidTriggerSensitivityRange = RAPID_TRIGGER_SENSITIVITY_RANGE;

  constructor(
    private readonly commands: WootingCommandChannel,
    private readonly reader: WootingProfileReader,
  ) {}

  async updateActiveProfile(change: ProfileSettingsChange): Promise<KeyboardProfile> {
    this.validate(change);
    const slot = await this.reader.readActiveSlot();
    const rawChange = toRawChange(change);
    const currentSettings = await this.commands.request(WootingCommand.getKeyboardProfile, [slot]);
    await this.commands.writeReport(encodeWootingReport(WootingReportType.settingsUpdateMarker, WootingReportStorage.saved));
    await this.commands.writeReport(encodeWootingReport(
      WootingReportType.keyboardProfileSettings,
      WootingReportStorage.saved,
      applyProfileSettingsChange(currentSettings, rawChange),
    ));
    await this.verifyStored(slot, rawChange);
    return this.reader.readProfile(slot);
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
