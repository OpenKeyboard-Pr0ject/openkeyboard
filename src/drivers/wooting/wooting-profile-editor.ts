import {
  assertWithinRange,
  type KeyboardProfile,
  type KeyboardProfileEditor,
  type KeySettingsChange,
  type ProfileSettingsChange,
} from "../../keyboard/keyboard-profile";
import { encodeWootingReport, storageForSavingToSlot } from "../../protocol/wooting/wooting-codec";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  ACTUATION_POINT_RANGE,
  RAPID_TRIGGER_SENSITIVITY_RANGE,
  WootingCommand,
  WootingReportType,
  type WootingReportTypeId,
} from "../../protocol/wooting/wooting-constants";
import { matrixPositionOf } from "../../protocol/wooting/wooting-matrix";
import {
  assignKeyActuation,
  assignKeyRapidTrigger,
  decodeRapidTriggerKeys,
  type WootingKeyRapidTrigger,
} from "../../protocol/wooting/wooting-per-key-codec";
import {
  applyProfileSettingsChange,
  decodeActuationOverrides,
  decodeProfileSettings,
  millimetersToPreciseTravel,
  type WootingProfileSettingsChange,
} from "../../protocol/wooting/wooting-profile-codec";
import type { WootingProfileReader } from "./wooting-profile-reader";

interface StoredProfilePart {
  readonly name: string;
  readonly reportType: WootingReportTypeId;
  readonly readCommand: (typeof WootingCommand)[keyof typeof WootingCommand];
  readonly normalize: (payload: Uint8Array) => string;
}

const RAPID_TRIGGER_PART: StoredProfilePart = {
  name: "per-key Rapid Trigger",
  reportType: WootingReportType.perKeyRapidTrigger,
  readCommand: WootingCommand.getPerKeyRapidTrigger,
  normalize: (payload) => JSON.stringify(decodeRapidTriggerKeys(payload).sort(byMatrixPosition)),
};

const SETTINGS_PART: StoredProfilePart = {
  name: "profile settings",
  reportType: WootingReportType.keyboardProfileSettings,
  readCommand: WootingCommand.getKeyboardProfile,
  normalize: (payload) => JSON.stringify(decodeProfileSettings(payload)),
};

const ACTUATION_PART: StoredProfilePart = {
  name: "per-key actuation",
  reportType: WootingReportType.perKeyActuation,
  readCommand: WootingCommand.getActuationProfile,
  normalize: (payload) => JSON.stringify(decodeActuationOverrides(payload).sort(byMatrixPosition)),
};

const WRITE_ORDER: readonly StoredProfilePart[] = [RAPID_TRIGGER_PART, SETTINGS_PART, ACTUATION_PART];

export class ProfileWriteNotVerifiedError extends Error {
  constructor(partNames: readonly string[]) {
    super(`The keyboard did not keep the new ${partNames.join(" and ")}.`);
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
    const plannedPayloads = await this.planPayloads(slot, change);
    const activeSlotBefore = await this.reader.readActiveSlot();
    for (const part of WRITE_ORDER) {
      const payload = plannedPayloads.get(part);
      if (payload) await this.commands.writeReport(encodeWootingReport(part.reportType, storage, payload));
    }
    await this.verifyStored(slot, plannedPayloads);
    await this.verifyActiveSlotUnchanged(activeSlotBefore);
    return this.reader.readProfile(slot);
  }

  private async planPayloads(slot: number, change: ProfileSettingsChange): Promise<Map<StoredProfilePart, Uint8Array>> {
    const currentSettings = await this.readPart(SETTINGS_PART, slot);
    if (currentSettings.length === 0) throw new EmptyProfileSlotError(slot);
    const planned = new Map<StoredProfilePart, Uint8Array>();
    const settingsChange = toRawSettingsChange(change);
    if (Object.keys(settingsChange).length > 0) {
      planned.set(SETTINGS_PART, applyProfileSettingsChange(currentSettings, settingsChange));
    }
    const keyChanges = change.keys ?? [];
    await this.planKeyPart(
      planned,
      ACTUATION_PART,
      slot,
      keyChanges.filter((key) => key.actuation),
      applyActuationChanges,
    );
    await this.planKeyPart(
      planned,
      RAPID_TRIGGER_PART,
      slot,
      keyChanges.filter((key) => key.rapidTrigger),
      applyRapidTriggerChanges,
    );
    return planned;
  }

  private async planKeyPart(
    planned: Map<StoredProfilePart, Uint8Array>,
    part: StoredProfilePart,
    slot: number,
    keyChanges: readonly KeySettingsChange[],
    applyChanges: (payload: Uint8Array, keyChanges: readonly KeySettingsChange[]) => Uint8Array,
  ): Promise<void> {
    if (keyChanges.length === 0) return;
    planned.set(part, applyChanges(await this.readPart(part, slot), keyChanges));
  }

  private validate(change: ProfileSettingsChange): void {
    this.validateActuation("Actuation point", change.actuationMillimeters);
    this.validateSensitivity("Rapid Trigger sensitivity", change.rapidTriggerSensitivityMillimeters);
    for (const keyChange of change.keys ?? []) {
      const keyActuation = keyChange.actuation?.kind === "custom" ? keyChange.actuation.millimeters : undefined;
      const keySensitivity = keyChange.rapidTrigger?.kind === "custom"
        ? keyChange.rapidTrigger.sensitivityMillimeters
        : undefined;
      this.validateActuation("Key actuation point", keyActuation);
      this.validateSensitivity("Key Rapid Trigger sensitivity", keySensitivity);
    }
  }

  private validateActuation(settingName: string, millimeters: number | undefined): void {
    if (millimeters !== undefined) assertWithinRange(settingName, millimeters, this.actuationRange);
  }

  private validateSensitivity(settingName: string, millimeters: number | undefined): void {
    if (millimeters !== undefined) assertWithinRange(settingName, millimeters, this.rapidTriggerSensitivityRange);
  }

  private readPart(part: StoredProfilePart, slot: number): Promise<Uint8Array> {
    return this.commands.request(part.readCommand, [slot]);
  }

  private async verifyStored(slot: number, plannedPayloads: ReadonlyMap<StoredProfilePart, Uint8Array>): Promise<void> {
    const unconfirmed: string[] = [];
    for (const [part, planned] of plannedPayloads) {
      const stored = await this.readPart(part, slot);
      if (part.normalize(stored) !== part.normalize(planned)) unconfirmed.push(part.name);
    }
    if (unconfirmed.length > 0) throw new ProfileWriteNotVerifiedError(unconfirmed);
  }

  private async verifyActiveSlotUnchanged(activeSlotBefore: number): Promise<void> {
    const activeSlotAfter = await this.reader.readActiveSlot();
    if (activeSlotAfter !== activeSlotBefore) throw new ActiveSlotChangedError(activeSlotBefore, activeSlotAfter);
  }
}

function applyActuationChanges(payload: Uint8Array, keyChanges: readonly KeySettingsChange[]): Uint8Array {
  return keyChanges.reduce(
    (current, keyChange) => assignKeyActuation(current, positionOf(keyChange), toRawActuation(keyChange)),
    payload,
  );
}

function applyRapidTriggerChanges(payload: Uint8Array, keyChanges: readonly KeySettingsChange[]): Uint8Array {
  return keyChanges.reduce(
    (current, keyChange) => assignKeyRapidTrigger(current, positionOf(keyChange), toRawRapidTrigger(keyChange)),
    payload,
  );
}

function toRawActuation(keyChange: KeySettingsChange): number | undefined {
  const setting = keyChange.actuation;
  return setting?.kind === "custom" ? millimetersToPreciseTravel(setting.millimeters) : undefined;
}

function toRawRapidTrigger(keyChange: KeySettingsChange): WootingKeyRapidTrigger {
  const setting = keyChange.rapidTrigger;
  if (setting?.kind === "custom") {
    return { kind: "custom-sensitivity", sensitivityRaw: millimetersToPreciseTravel(setting.sensitivityMillimeters) };
  }
  if (setting?.kind === "profile-sensitivity") return { kind: "profile-sensitivity" };
  return { kind: "follow-profile" };
}

function positionOf(keyChange: KeySettingsChange): number {
  return matrixPositionOf(keyChange.key.matrixRow, keyChange.key.matrixColumn);
}

function byMatrixPosition(first: { matrixPosition: number }, second: { matrixPosition: number }): number {
  return first.matrixPosition - second.matrixPosition;
}

function toRawSettingsChange(change: ProfileSettingsChange): WootingProfileSettingsChange {
  const raw: { -readonly [Field in keyof WootingProfileSettingsChange]: WootingProfileSettingsChange[Field] } = {};
  if (change.actuationMillimeters !== undefined) {
    raw.actuationRaw = millimetersToPreciseTravel(change.actuationMillimeters);
  }
  if (change.rapidTriggerEnabled !== undefined) raw.rapidTriggerEnabled = change.rapidTriggerEnabled;
  if (change.rapidTriggerSensitivityMillimeters !== undefined) {
    raw.rapidTriggerSensitivityRaw = millimetersToPreciseTravel(change.rapidTriggerSensitivityMillimeters);
  }
  if (change.continuousRapidTrigger !== undefined) raw.continuousRapidTriggerEnabled = change.continuousRapidTrigger;
  return raw;
}
