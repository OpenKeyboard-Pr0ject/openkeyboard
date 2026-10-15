import { useState } from "react";
import {
  BRIGHTNESS_PERCENT_RANGE,
  type KeyboardLightingEditor,
  type LightingState,
  type WritableLightingEffectKind,
} from "../../../keyboard/lighting";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { Message } from "../../components/feedback";
import { RangeInput } from "../../components/inputs";
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
    <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
      <Card title="Effects">
        <div className="flex flex-col gap-5">
          <div>
            <SectionLabel>Global brightness</SectionLabel>
            <RangeInput
              label="Brightness"
              value={brightnessPercent}
              range={BRIGHTNESS_PERCENT_RANGE}
              valueLabel={`${brightnessPercent} %`}
              disabled={busy}
              onChange={setBrightnessPercent}
            />
          </div>
          <div>
            <SectionLabel>Effect selection</SectionLabel>
            <EffectTiles
              effects={editor.supportedEffects}
              selected={effectDraft.kind}
              disabled={busy}
              onSelect={chooseEffect}
            />
          </div>
        </div>
      </Card>
      <Card title="Effect parameters">
        <div className="flex flex-col gap-4">
          {hasEffectOptions(effectDraft.kind) ? (
            <EffectOptions
              draft={effectDraft}
              maximumColors={editor.maximumEffectColors}
              disabled={busy}
              onChange={setEffectDraft}
            />
          ) : <Message>This effect has no options.</Message>}
        </div>
      </Card>
      <div className="flex flex-col gap-3 md:col-span-2">
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
      </div>
    </form>
  );
}

const EFFECT_TILES_CLASSES = "grid grid-cols-2 gap-2 rounded-lg bg-sunken p-2 sm:grid-cols-3";
const EFFECTS_WITHOUT_OPTIONS: ReadonlySet<WritableLightingEffectKind> = new Set(["off", "spectrum"]);

function hasEffectOptions(kind: WritableLightingEffectKind): boolean {
  return !EFFECTS_WITHOUT_OPTIONS.has(kind);
}

interface EffectTilesProps {
  readonly effects: readonly WritableLightingEffectKind[];
  readonly selected: WritableLightingEffectKind;
  readonly disabled: boolean;
  readonly onSelect: (kind: WritableLightingEffectKind) => void;
}

function EffectTiles({ effects, selected, disabled, onSelect }: EffectTilesProps) {
  return (
    <div role="radiogroup" aria-label="Effect" className={EFFECT_TILES_CLASSES}>
      {effects.map((kind) => {
        const isSelected = kind === selected;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(kind)}
            className={[
              "h-10 rounded-md px-3 text-left text-base transition",
              "focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed",
              isSelected ? "bg-accent font-bold text-on-accent" : "text-fg hover:bg-tint",
            ].join(" ")}
          >
            {EFFECT_LABELS[kind]}
          </button>
        );
      })}
    </div>
  );
}
