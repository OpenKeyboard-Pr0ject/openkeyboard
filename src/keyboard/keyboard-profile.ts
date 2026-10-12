import type { MatrixKey } from "./matrix-key";

export interface KeyActuation {
  readonly key: MatrixKey;
  readonly actuationMillimeters: number;
}

export interface RapidTriggerSettings {
  readonly enabled: boolean;
  readonly sensitivityMillimeters: number;
  readonly continuous: boolean;
}

export interface KeyboardProfileSummary {
  readonly slot: number;
  readonly name: string;
  readonly color: string;
}

export interface KeyboardProfile extends KeyboardProfileSummary {
  readonly actuationMillimeters: number;
  readonly rapidTrigger: RapidTriggerSettings;
  readonly keyActuations: readonly KeyActuation[];
}

export interface SettingRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface ProfileSettingsChange {
  readonly actuationMillimeters?: number;
  readonly rapidTriggerEnabled?: boolean;
  readonly rapidTriggerSensitivityMillimeters?: number;
  readonly continuousRapidTrigger?: boolean;
}

export interface KeyboardProfileEditor {
  readonly actuationRange: SettingRange;
  readonly rapidTriggerSensitivityRange: SettingRange;
  updateProfile(slot: number, change: ProfileSettingsChange): Promise<KeyboardProfile>;
}

export class SettingOutOfRangeError extends Error {
  constructor(settingName: string, value: number, range: SettingRange) {
    super(`${settingName} must be between ${range.min} and ${range.max} mm in steps of ${range.step} mm, not ${value} mm.`);
    this.name = "SettingOutOfRangeError";
  }
}

const STEP_TOLERANCE = 1e-6;

export function assertWithinRange(settingName: string, value: number, range: SettingRange): void {
  const stepsFromMinimum = (value - range.min) / range.step;
  const onStep = Math.abs(stepsFromMinimum - Math.round(stepsFromMinimum)) < STEP_TOLERANCE;
  const inside = value >= range.min - STEP_TOLERANCE && value <= range.max + STEP_TOLERANCE;
  if (!Number.isFinite(value) || !inside || !onStep) throw new SettingOutOfRangeError(settingName, value, range);
}

export interface KeyboardProfileReader {
  readActiveSlot(): Promise<number>;
  listProfiles(): Promise<KeyboardProfileSummary[]>;
  readProfile(slot: number): Promise<KeyboardProfile>;
}
