import type {
  KeyActuationSetting,
  KeyboardProfile,
  KeyRapidTriggerSetting,
  KeySettingsChange,
  ProfileSettingsChange,
  RapidTriggerSettings,
} from "../../keyboard/keyboard-profile";
import type { MatrixKey } from "../../keyboard/matrix-key";
import { matrixKeyId } from "../../keyboard/physical-layout";

export interface KeyTuning {
  readonly key: MatrixKey;
  readonly actuation: KeyActuationSetting;
  readonly rapidTrigger: KeyRapidTriggerSetting;
}

export interface AnalogDraft {
  readonly actuationMillimeters: number;
  readonly rapidTrigger: RapidTriggerSettings;
  readonly keys: ReadonlyMap<string, KeyTuning>;
}

export interface KeyRapidTriggerState {
  readonly enabled: boolean;
  readonly sensitivityMillimeters: number;
  readonly hasOwnSensitivity: boolean;
}

const FOLLOW_PROFILE_ACTUATION: KeyActuationSetting = { kind: "follow-profile" };
const FOLLOW_PROFILE_RAPID_TRIGGER: KeyRapidTriggerSetting = { kind: "follow-profile" };
const PROFILE_SENSITIVITY: KeyRapidTriggerSetting = { kind: "profile-sensitivity" };

export function initialAnalogDraft(profile: KeyboardProfile): AnalogDraft {
  const keys = new Map<string, KeyTuning>();
  const tuningOf = (key: MatrixKey) => keys.get(matrixKeyId(key)) ?? defaultTuning(key);
  for (const { key, actuationMillimeters } of profile.keyActuations) {
    keys.set(matrixKeyId(key), { ...tuningOf(key), actuation: { kind: "custom", millimeters: actuationMillimeters } });
  }
  for (const { key, usesProfileSensitivity, sensitivityMillimeters } of profile.keyRapidTriggers) {
    const rapidTrigger: KeyRapidTriggerSetting = usesProfileSensitivity
      ? PROFILE_SENSITIVITY
      : { kind: "custom", sensitivityMillimeters };
    keys.set(matrixKeyId(key), { ...tuningOf(key), rapidTrigger });
  }
  return { actuationMillimeters: profile.actuationMillimeters, rapidTrigger: profile.rapidTrigger, keys };
}

export function keyTuning(draft: AnalogDraft, key: MatrixKey): KeyTuning {
  return draft.keys.get(matrixKeyId(key)) ?? defaultTuning(key);
}

export function effectiveActuation(draft: AnalogDraft, key: MatrixKey): number {
  const { actuation } = keyTuning(draft, key);
  return actuation.kind === "custom" ? actuation.millimeters : draft.actuationMillimeters;
}

export function hasOwnActuation(draft: AnalogDraft, key: MatrixKey): boolean {
  return keyTuning(draft, key).actuation.kind === "custom";
}

export function keyRapidTriggerState(draft: AnalogDraft, key: MatrixKey): KeyRapidTriggerState {
  const { rapidTrigger } = keyTuning(draft, key);
  if (rapidTrigger.kind === "custom") {
    return { enabled: true, sensitivityMillimeters: rapidTrigger.sensitivityMillimeters, hasOwnSensitivity: true };
  }
  return {
    enabled: rapidTrigger.kind === "profile-sensitivity" || draft.rapidTrigger.enabled,
    sensitivityMillimeters: draft.rapidTrigger.sensitivityMillimeters,
    hasOwnSensitivity: false,
  };
}

export function coversWholeBoard(selected: readonly MatrixKey[], board: readonly MatrixKey[]): boolean {
  const selectedIds = new Set(selected.map(matrixKeyId));
  return board.length > 0 && board.every((key) => selectedIds.has(matrixKeyId(key)));
}

export function withActuation(
  draft: AnalogDraft,
  selected: readonly MatrixKey[],
  millimeters: number,
  board: readonly MatrixKey[],
): AnalogDraft {
  if (coversWholeBoard(selected, board)) {
    const followingDraft = mapTunings(draft, (tuning) => ({ ...tuning, actuation: FOLLOW_PROFILE_ACTUATION }));
    return { ...followingDraft, actuationMillimeters: millimeters };
  }
  const actuation: KeyActuationSetting = millimeters === draft.actuationMillimeters
    ? FOLLOW_PROFILE_ACTUATION
    : { kind: "custom", millimeters };
  return withTunings(draft, selected, (tuning) => ({ ...tuning, actuation }));
}

export function withProfileActuation(draft: AnalogDraft, selected: readonly MatrixKey[]): AnalogDraft {
  return withTunings(draft, selected, (tuning) => ({ ...tuning, actuation: FOLLOW_PROFILE_ACTUATION }));
}

export function withRapidTriggerEnabled(
  draft: AnalogDraft,
  selected: readonly MatrixKey[],
  enabled: boolean,
  board: readonly MatrixKey[],
): AnalogDraft {
  if (coversWholeBoard(selected, board)) {
    const profileLevel = { ...draft, rapidTrigger: { ...draft.rapidTrigger, enabled } };
    return enabled
      ? profileLevel
      : mapTunings(profileLevel, (tuning) => ({ ...tuning, rapidTrigger: FOLLOW_PROFILE_RAPID_TRIGGER }));
  }
  if (enabled) {
    return withTunings(draft, selected, (tuning) => (
      keyRapidTriggerState(draft, tuning.key).enabled ? tuning : { ...tuning, rapidTrigger: PROFILE_SENSITIVITY }
    ));
  }
  const disabledSelection = withTunings(draft, selected, (tuning) => ({
    ...tuning,
    rapidTrigger: FOLLOW_PROFILE_RAPID_TRIGGER,
  }));
  if (!draft.rapidTrigger.enabled) return disabledSelection;
  const selectedIds = new Set(selected.map(matrixKeyId));
  const keepEnabled = board.filter((key) => !selectedIds.has(matrixKeyId(key)));
  const perKeyDraft = withTunings(disabledSelection, keepEnabled, (tuning) => (
    tuning.rapidTrigger.kind === "follow-profile" ? { ...tuning, rapidTrigger: PROFILE_SENSITIVITY } : tuning
  ));
  return { ...perKeyDraft, rapidTrigger: { ...draft.rapidTrigger, enabled: false } };
}

export function withRapidTriggerSensitivity(
  draft: AnalogDraft,
  selected: readonly MatrixKey[],
  sensitivityMillimeters: number,
  board: readonly MatrixKey[],
): AnalogDraft {
  if (coversWholeBoard(selected, board)) {
    const sharedDraft = mapTunings(draft, (tuning) => (
      tuning.rapidTrigger.kind === "custom" ? { ...tuning, rapidTrigger: PROFILE_SENSITIVITY } : tuning
    ));
    return { ...sharedDraft, rapidTrigger: { ...draft.rapidTrigger, sensitivityMillimeters } };
  }
  return withTunings(draft, selected, (tuning) => ({
    ...tuning,
    rapidTrigger: { kind: "custom", sensitivityMillimeters },
  }));
}

export function withContinuousRapidTrigger(draft: AnalogDraft, continuous: boolean): AnalogDraft {
  return { ...draft, rapidTrigger: { ...draft.rapidTrigger, continuous } };
}

export function analogSettingsChange(profile: KeyboardProfile, draft: AnalogDraft): ProfileSettingsChange {
  const original = initialAnalogDraft(profile);
  const ids = new Set([...original.keys.keys(), ...draft.keys.keys()]);
  const keys = [...ids].flatMap((id) => keyChange(original.keys.get(id), draft.keys.get(id)));
  return {
    ...(keys.length > 0 ? { keys } : {}),
    ...(draft.actuationMillimeters !== profile.actuationMillimeters
      ? { actuationMillimeters: draft.actuationMillimeters } : {}),
    ...(draft.rapidTrigger.enabled !== profile.rapidTrigger.enabled
      ? { rapidTriggerEnabled: draft.rapidTrigger.enabled } : {}),
    ...(draft.rapidTrigger.sensitivityMillimeters !== profile.rapidTrigger.sensitivityMillimeters
      ? { rapidTriggerSensitivityMillimeters: draft.rapidTrigger.sensitivityMillimeters } : {}),
    ...(draft.rapidTrigger.continuous !== profile.rapidTrigger.continuous
      ? { continuousRapidTrigger: draft.rapidTrigger.continuous } : {}),
  };
}

export function hasAnalogChanges(profile: KeyboardProfile, draft: AnalogDraft): boolean {
  return Object.keys(analogSettingsChange(profile, draft)).length > 0;
}

function keyChange(original: KeyTuning | undefined, next: KeyTuning | undefined): KeySettingsChange[] {
  const key = next?.key ?? original?.key;
  if (!key) return [];
  const before = original ?? defaultTuning(key);
  const after = next ?? defaultTuning(key);
  const actuationChanged = !sameSetting(before.actuation, after.actuation);
  const rapidTriggerChanged = !sameSetting(before.rapidTrigger, after.rapidTrigger);
  if (!actuationChanged && !rapidTriggerChanged) return [];
  return [{
    key,
    ...(actuationChanged ? { actuation: after.actuation } : {}),
    ...(rapidTriggerChanged ? { rapidTrigger: after.rapidTrigger } : {}),
  }];
}

function withTunings(
  draft: AnalogDraft,
  keys: readonly MatrixKey[],
  change: (tuning: KeyTuning) => KeyTuning,
): AnalogDraft {
  const next = new Map(draft.keys);
  for (const key of keys) storeTuning(next, change(keyTuning(draft, key)));
  return { ...draft, keys: next };
}

function mapTunings(draft: AnalogDraft, change: (tuning: KeyTuning) => KeyTuning): AnalogDraft {
  const next = new Map<string, KeyTuning>();
  for (const tuning of draft.keys.values()) storeTuning(next, change(tuning));
  return { ...draft, keys: next };
}

function storeTuning(tunings: Map<string, KeyTuning>, tuning: KeyTuning): void {
  const id = matrixKeyId(tuning.key);
  const followsProfile = tuning.actuation.kind === "follow-profile" && tuning.rapidTrigger.kind === "follow-profile";
  if (followsProfile) tunings.delete(id);
  else tunings.set(id, tuning);
}

function defaultTuning(key: MatrixKey): KeyTuning {
  return { key, actuation: FOLLOW_PROFILE_ACTUATION, rapidTrigger: FOLLOW_PROFILE_RAPID_TRIGGER };
}

function sameSetting(first: KeyActuationSetting | KeyRapidTriggerSetting, second: typeof first): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
