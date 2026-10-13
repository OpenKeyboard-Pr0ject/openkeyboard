import type {
  KeyActuationSetting,
  KeyboardProfile,
  KeyRapidTriggerSetting,
  KeySettingsChange,
  ProfileSettingsChange,
} from "../../../keyboard/keyboard-profile";
import type { MatrixKey } from "../../../keyboard/matrix-key";

export type ActuationMode = KeyActuationSetting["kind"];
export type RapidTriggerMode = KeyRapidTriggerSetting["kind"];

export interface KeySettings {
  readonly actuation: KeyActuationSetting;
  readonly rapidTrigger: KeyRapidTriggerSetting;
}

export interface KeySettingsDraft {
  readonly key: MatrixKey;
  readonly original: KeySettings;
  readonly actuationMode: ActuationMode;
  readonly actuationMillimeters: string;
  readonly rapidTriggerMode: RapidTriggerMode;
  readonly sensitivityMillimeters: string;
}

export interface ProfileDraft {
  readonly actuationMillimeters: string;
  readonly rapidTriggerEnabled: boolean;
  readonly sensitivityMillimeters: string;
  readonly continuous: boolean;
  readonly keys: readonly KeySettingsDraft[];
}

const FOLLOW_PROFILE_SETTINGS: KeySettings = {
  actuation: { kind: "follow-profile" },
  rapidTrigger: { kind: "follow-profile" },
};

export function initialProfileDraft(profile: KeyboardProfile): ProfileDraft {
  return {
    actuationMillimeters: millimeterText(profile.actuationMillimeters),
    rapidTriggerEnabled: profile.rapidTrigger.enabled,
    sensitivityMillimeters: millimeterText(profile.rapidTrigger.sensitivityMillimeters),
    continuous: profile.rapidTrigger.continuous,
    keys: [...initialKeySettings(profile)].map(([key, settings]) => keyDraft(key, settings, profile)),
  };
}

export function newKeyDraft(key: MatrixKey, profile: KeyboardProfile): KeySettingsDraft {
  return keyDraft(key, FOLLOW_PROFILE_SETTINGS, profile);
}

export function resetKeyDraft(draft: KeySettingsDraft): KeySettingsDraft {
  return { ...draft, actuationMode: "follow-profile", rapidTriggerMode: "follow-profile" };
}

export function keySettingsChange(draft: KeySettingsDraft): KeySettingsChange | undefined {
  const actuation = actuationSetting(draft);
  const rapidTrigger = rapidTriggerSetting(draft);
  const actuationChanged = JSON.stringify(actuation) !== JSON.stringify(draft.original.actuation);
  const rapidTriggerChanged = JSON.stringify(rapidTrigger) !== JSON.stringify(draft.original.rapidTrigger);
  if (!actuationChanged && !rapidTriggerChanged) return undefined;
  return {
    key: draft.key,
    ...(actuationChanged ? { actuation } : {}),
    ...(rapidTriggerChanged ? { rapidTrigger } : {}),
  };
}

export function profileSettingsChange(profile: KeyboardProfile, draft: ProfileDraft): ProfileSettingsChange {
  const actuation = parseMillimeters(draft.actuationMillimeters);
  const sensitivity = parseMillimeters(draft.sensitivityMillimeters);
  const keys = draft.keys
    .map(keySettingsChange)
    .filter((change): change is KeySettingsChange => change !== undefined);
  return {
    ...(keys.length > 0 ? { keys } : {}),
    ...(actuation !== profile.actuationMillimeters ? { actuationMillimeters: actuation } : {}),
    ...(draft.rapidTriggerEnabled !== profile.rapidTrigger.enabled
      ? { rapidTriggerEnabled: draft.rapidTriggerEnabled } : {}),
    ...(sensitivity !== profile.rapidTrigger.sensitivityMillimeters
      ? { rapidTriggerSensitivityMillimeters: sensitivity } : {}),
    ...(draft.continuous !== profile.rapidTrigger.continuous ? { continuousRapidTrigger: draft.continuous } : {}),
  };
}

export function keysAvailableToAdd(profile: KeyboardProfile, drafts: readonly KeySettingsDraft[]): MatrixKey[] {
  const listed = new Set(drafts.map((draft) => keyId(draft.key)));
  return profile.layout.filter((key) => !listed.has(keyId(key)));
}

export function keyId(key: MatrixKey): string {
  return `${key.matrixRow}:${key.matrixColumn}`;
}

function keyDraft(key: MatrixKey, settings: KeySettings, profile: KeyboardProfile): KeySettingsDraft {
  const { actuation, rapidTrigger } = settings;
  return {
    key,
    original: settings,
    actuationMode: actuation.kind,
    actuationMillimeters: millimeterText(
      actuation.kind === "custom" ? actuation.millimeters : profile.actuationMillimeters,
    ),
    rapidTriggerMode: rapidTrigger.kind,
    sensitivityMillimeters: millimeterText(
      rapidTrigger.kind === "custom"
        ? rapidTrigger.sensitivityMillimeters
        : profile.rapidTrigger.sensitivityMillimeters,
    ),
  };
}

function actuationSetting(draft: KeySettingsDraft): KeyActuationSetting {
  return draft.actuationMode === "custom"
    ? { kind: "custom", millimeters: parseMillimeters(draft.actuationMillimeters) }
    : { kind: "follow-profile" };
}

function rapidTriggerSetting(draft: KeySettingsDraft): KeyRapidTriggerSetting {
  if (draft.rapidTriggerMode === "custom") {
    return { kind: "custom", sensitivityMillimeters: parseMillimeters(draft.sensitivityMillimeters) };
  }
  return draft.rapidTriggerMode === "profile-sensitivity"
    ? { kind: "profile-sensitivity" }
    : { kind: "follow-profile" };
}

function initialKeySettings(profile: KeyboardProfile): Map<MatrixKey, KeySettings> {
  const byId = new Map<string, { key: MatrixKey; settings: KeySettings }>();
  const entryFor = (key: MatrixKey) => byId.get(keyId(key)) ?? { key, settings: FOLLOW_PROFILE_SETTINGS };
  for (const { key, actuationMillimeters } of profile.keyActuations) {
    const entry = entryFor(key);
    const actuation: KeyActuationSetting = { kind: "custom", millimeters: actuationMillimeters };
    byId.set(keyId(key), { key, settings: { ...entry.settings, actuation } });
  }
  for (const { key, usesProfileSensitivity, sensitivityMillimeters } of profile.keyRapidTriggers) {
    const entry = entryFor(key);
    const rapidTrigger: KeyRapidTriggerSetting = usesProfileSensitivity
      ? { kind: "profile-sensitivity" }
      : { kind: "custom", sensitivityMillimeters };
    byId.set(keyId(key), { key, settings: { ...entry.settings, rapidTrigger } });
  }
  return new Map([...byId.values()].map(({ key, settings }) => [key, settings]));
}

export function parseMillimeters(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

function millimeterText(millimeters: number): string {
  return millimeters.toFixed(2);
}
