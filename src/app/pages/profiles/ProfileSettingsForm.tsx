import { useState } from "react";
import type { KeyboardProfile, KeyboardProfileEditor } from "../../../keyboard/keyboard-profile";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Message } from "../../components/feedback";
import { Field, NumberInput, Toggle } from "../../components/inputs";
import { KeySettingsEditor } from "./KeySettingsEditor";
import { initialProfileDraft, type ProfileDraft, profileSettingsChange } from "./profile-draft";

interface ProfileSettingsFormProps {
  readonly profile: KeyboardProfile;
  readonly isActiveProfile: boolean;
  readonly editor: KeyboardProfileEditor;
  readonly onSaved: (profile: KeyboardProfile) => void;
  readonly onCancel: () => void;
}

export function ProfileSettingsForm({ profile, isActiveProfile, editor, onSaved, onCancel }: ProfileSettingsFormProps) {
  const [draft, setDraft] = useState<ProfileDraft>(() => initialProfileDraft(profile));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const update = (changes: Partial<ProfileDraft>) => setDraft((current) => ({ ...current, ...changes }));

  const save = async () => {
    const change = profileSettingsChange(profile, draft);
    if (Object.keys(change).length === 0) {
      setStatus("Nothing changed.");
      return;
    }
    setBusy(true);
    setStatus("Writing to the keyboard…");
    try {
      onSaved(await editor.updateProfile(profile.slot, change));
    } catch (error) {
      setStatus(`Not saved: ${describeError(error)}`);
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <Field label="Actuation point (mm)">
        <NumberInput
          value={draft.actuationMillimeters}
          range={editor.actuationRange}
          disabled={busy}
          onChange={(actuationMillimeters) => update({ actuationMillimeters })}
        />
      </Field>
      <Field label="Rapid Trigger">
        <Toggle
          label="Rapid Trigger"
          checked={draft.rapidTriggerEnabled}
          disabled={busy}
          onChange={(rapidTriggerEnabled) => update({ rapidTriggerEnabled })}
        />
      </Field>
      <Field label="Rapid Trigger sensitivity (mm)">
        <NumberInput
          value={draft.sensitivityMillimeters}
          range={editor.rapidTriggerSensitivityRange}
          disabled={busy}
          onChange={(sensitivityMillimeters) => update({ sensitivityMillimeters })}
        />
      </Field>
      <Field label="Continuous Rapid Trigger">
        <Toggle
          label="Continuous Rapid Trigger"
          checked={draft.continuous}
          disabled={busy}
          onChange={(continuous) => update({ continuous })}
        />
      </Field>
      <KeySettingsEditor
        profile={profile}
        drafts={draft.keys}
        ranges={{ actuation: editor.actuationRange, sensitivity: editor.rapidTriggerSensitivityRange }}
        disabled={busy}
        onChange={(keys) => update({ keys })}
      />
      <Message>{targetDescription(profile.name, isActiveProfile)}</Message>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => void save()}>
          Save to keyboard
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {status && <Message>{status}</Message>}
    </form>
  );
}

function targetDescription(profileName: string, isActiveProfile: boolean): string {
  const written = `Changes are written to "${profileName}" and read back to confirm.`;
  return isActiveProfile
    ? written
    : `${written} This profile is not active, so the keyboard keeps using its current profile until you switch.`;
}
