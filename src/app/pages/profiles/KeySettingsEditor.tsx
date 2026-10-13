import { useState } from "react";
import { keyLabel } from "../../../keyboard/hid-key-names";
import type { KeyboardProfile, SettingRange } from "../../../keyboard/keyboard-profile";
import { Button } from "../../components/Button";
import { NumberInput, SelectInput, type SelectOption } from "../../components/inputs";
import {
  type ActuationMode,
  keyId,
  type KeySettingsDraft,
  keysAvailableToAdd,
  newKeyDraft,
  type RapidTriggerMode,
  resetKeyDraft,
} from "./profile-draft";

export interface KeySettingRanges {
  readonly actuation: SettingRange;
  readonly sensitivity: SettingRange;
}

const ACTUATION_MODES: readonly SelectOption[] = [
  { value: "follow-profile", label: "Profile actuation" },
  { value: "custom", label: "Custom" },
];

const RAPID_TRIGGER_MODES: readonly SelectOption[] = [
  { value: "follow-profile", label: "Profile Rapid Trigger" },
  { value: "profile-sensitivity", label: "On, profile sensitivity" },
  { value: "custom", label: "On, custom" },
];

interface KeySettingsEditorProps {
  readonly profile: KeyboardProfile;
  readonly drafts: readonly KeySettingsDraft[];
  readonly ranges: KeySettingRanges;
  readonly disabled: boolean;
  readonly onChange: (drafts: readonly KeySettingsDraft[]) => void;
}

export function KeySettingsEditor({ profile, drafts, ranges, disabled, onChange }: KeySettingsEditorProps) {
  const availableKeys = keysAvailableToAdd(profile, drafts);
  const [pickedKeyId, setPickedKeyId] = useState<string>();
  const pickedKey = availableKeys.find((key) => keyId(key) === pickedKeyId) ?? availableKeys[0];
  const replaceDraft = (index: number, draft: KeySettingsDraft) => {
    onChange(drafts.map((existing, existingIndex) => (existingIndex === index ? draft : existing)));
  };
  const addPickedKey = () => {
    if (pickedKey) onChange([...drafts, newKeyDraft(pickedKey, profile)]);
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">Per-key settings</h3>
      <div className="flex flex-col gap-2">
        {drafts.map((draft, index) => (
          <KeySettingsRow
            key={keyId(draft.key)}
            draft={draft}
            ranges={ranges}
            disabled={disabled}
            onChange={(changed) => replaceDraft(index, changed)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <SelectInput
          className="min-w-0 flex-1"
          label="Key to add"
          value={pickedKey ? keyId(pickedKey) : ""}
          options={availableKeys.map((key) => ({ value: keyId(key), label: keyLabel(key) }))}
          disabled={disabled}
          onChange={setPickedKeyId}
        />
        <Button size="small" disabled={disabled || !pickedKey} onClick={addPickedKey}>
          Add key
        </Button>
      </div>
    </section>
  );
}

interface KeySettingsRowProps {
  readonly draft: KeySettingsDraft;
  readonly ranges: KeySettingRanges;
  readonly disabled: boolean;
  readonly onChange: (draft: KeySettingsDraft) => void;
}

function KeySettingsRow({ draft, ranges, disabled, onChange }: KeySettingsRowProps) {
  const label = keyLabel(draft.key);
  return (
    <div className="grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-raised p-3">
      <span className="row-span-3 self-start pt-2 text-sm font-semibold text-fg">{label}</span>
      <div className="flex items-center gap-2">
        <SelectInput
          className="min-w-0 flex-1"
          label={`${label} actuation`}
          value={draft.actuationMode}
          options={ACTUATION_MODES}
          disabled={disabled}
          onChange={(mode) => onChange({ ...draft, actuationMode: mode as ActuationMode })}
        />
        <NumberInput
          label={`${label} actuation point in millimeters`}
          value={draft.actuationMillimeters}
          range={ranges.actuation}
          disabled={disabled || draft.actuationMode !== "custom"}
          onChange={(value) => onChange({ ...draft, actuationMillimeters: value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <SelectInput
          className="min-w-0 flex-1"
          label={`${label} Rapid Trigger`}
          value={draft.rapidTriggerMode}
          options={RAPID_TRIGGER_MODES}
          disabled={disabled}
          onChange={(mode) => onChange({ ...draft, rapidTriggerMode: mode as RapidTriggerMode })}
        />
        <NumberInput
          label={`${label} Rapid Trigger sensitivity in millimeters`}
          value={draft.sensitivityMillimeters}
          range={ranges.sensitivity}
          disabled={disabled || draft.rapidTriggerMode !== "custom"}
          onChange={(value) => onChange({ ...draft, sensitivityMillimeters: value })}
        />
      </div>
      <div>
        <Button size="small" variant="ghost" disabled={disabled} onClick={() => onChange(resetKeyDraft(draft))}>
          Reset
        </Button>
      </div>
    </div>
  );
}
