import { useState } from "react";
import {
  BRIGHTNESS_PERCENT_RANGE,
  type KeyboardLightingEditor,
  type LightingState,
  type WritableLightingEffectKind,
} from "../../../keyboard/lighting";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Message } from "../../components/feedback";
import { Field, RangeInput, SelectInput } from "../../components/inputs";
import { EFFECT_LABELS } from "../../format/lighting-format";
import { type EffectDraft, initialEffectDraft, initialEffectKind, lightingChange } from "./effect-draft";
import { EffectOptions } from "./EffectOptions";

interface LightingFormProps {
  readonly current: LightingState;
  readonly editor: KeyboardLightingEditor;
  readonly onSaved: (state: LightingState) => void;
  readonly onCancel: () => void;
}

export function LightingForm({ current, editor, onSaved, onCancel }: LightingFormProps) {
  const [brightnessPercent, setBrightnessPercent] = useState(current.brightnessPercent);
  const [effectDraft, setEffectDraft] = useState<EffectDraft>(() => {
    const kind = initialEffectKind(current.effect, editor.supportedEffects);
    return initialEffectDraft(kind, current.effect, editor.maximumEffectColors);
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();

  const chooseEffect = (kind: WritableLightingEffectKind) => {
    setEffectDraft(initialEffectDraft(kind, current.effect, editor.maximumEffectColors));
  };

  const save = async () => {
    const change = lightingChange(current, brightnessPercent, effectDraft);
    if (Object.keys(change).length === 0) {
      setStatus("Nothing changed.");
      return;
    }
    setBusy(true);
    setStatus("Writing to the keyboard…");
    try {
      onSaved(await editor.updateLighting(change));
    } catch (error) {
      setStatus(`Not saved: ${describeError(error)}`);
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <Field label="Brightness">
        <RangeInput
          label="Brightness"
          value={brightnessPercent}
          range={BRIGHTNESS_PERCENT_RANGE}
          valueLabel={`${brightnessPercent} %`}
          disabled={busy}
          onChange={setBrightnessPercent}
        />
      </Field>
      <Field label="Effect">
        <SelectInput
          label="Effect"
          value={effectDraft.kind}
          options={editor.supportedEffects.map((kind) => ({ value: kind, label: EFFECT_LABELS[kind] }))}
          disabled={busy}
          onChange={(kind) => chooseEffect(kind as WritableLightingEffectKind)}
        />
      </Field>
      <EffectOptions
        draft={effectDraft}
        maximumColors={editor.maximumEffectColors}
        disabled={busy}
        onChange={setEffectDraft}
      />
      <Message>Changes are saved on the keyboard and read back to confirm.</Message>
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
