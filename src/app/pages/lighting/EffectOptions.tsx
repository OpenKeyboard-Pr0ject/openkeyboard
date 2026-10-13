import type { EffectDuration, WaveDirection } from "../../../keyboard/lighting";
import { ColorInput, Field, SelectInput, type SelectOption } from "../../components/inputs";
import { colorCountLabel, DURATION_LABELS, WAVE_DIRECTION_LABELS } from "../../format/lighting-format";
import { type EffectDraft, usesColorCount } from "./effect-draft";

const DURATION_OPTIONS: readonly SelectOption[] = Object.entries(DURATION_LABELS)
  .map(([value, label]) => ({ value, label }));
const DIRECTION_OPTIONS: readonly SelectOption[] = Object.entries(WAVE_DIRECTION_LABELS)
  .map(([value, label]) => ({ value, label }));

interface EffectOptionsProps {
  readonly draft: EffectDraft;
  readonly maximumColors: number;
  readonly disabled: boolean;
  readonly onChange: (draft: EffectDraft) => void;
}

export function EffectOptions({ draft, maximumColors, disabled, onChange }: EffectOptionsProps) {
  const update = (changes: Partial<EffectDraft>) => onChange({ ...draft, ...changes });
  const setColor = (index: number, color: string) => {
    update({ colors: draft.colors.map((existing, existingIndex) => (existingIndex === index ? color : existing)) });
  };
  const showsSingleColor = draft.kind === "static" || draft.kind === "reactive";
  const showsColorCount = usesColorCount(draft.kind);

  return (
    <>
      {showsSingleColor && (
        <Field label="Color">
          <ColorInput
            label="Color"
            value={draft.colors[0]}
            disabled={disabled}
            onChange={(color) => setColor(0, color)}
          />
        </Field>
      )}
      {draft.kind === "reactive" && <DurationField label="Fade" draft={draft} disabled={disabled} onChange={update} />}
      {draft.kind === "wave" && (
        <Field label="Direction">
          <SelectInput
            label="Direction"
            value={draft.direction}
            options={DIRECTION_OPTIONS}
            disabled={disabled}
            onChange={(direction) => update({ direction: direction as WaveDirection })}
          />
        </Field>
      )}
      {showsColorCount && (
        <>
          <Field label="Colors">
            <SelectInput
              label="Colors"
              value={String(draft.colorCount)}
              options={colorCountOptions(maximumColors)}
              disabled={disabled}
              onChange={(count) => update({ colorCount: Number(count) })}
            />
          </Field>
          {draft.colors.slice(0, draft.colorCount).map((color, index) => (
            <Field key={index} label={`Color ${index + 1}`}>
              <ColorInput
                label={`Color ${index + 1}`}
                value={color}
                disabled={disabled}
                onChange={(changed) => setColor(index, changed)}
              />
            </Field>
          ))}
        </>
      )}
      {draft.kind === "starlight" && (
        <DurationField label="Twinkle" draft={draft} disabled={disabled} onChange={update} />
      )}
    </>
  );
}

interface DurationFieldProps {
  readonly label: string;
  readonly draft: EffectDraft;
  readonly disabled: boolean;
  readonly onChange: (changes: Partial<EffectDraft>) => void;
}

function DurationField({ label, draft, disabled, onChange }: DurationFieldProps) {
  return (
    <Field label={label}>
      <SelectInput
        label={label}
        value={draft.duration}
        options={DURATION_OPTIONS}
        disabled={disabled}
        onChange={(duration) => onChange({ duration: duration as EffectDuration })}
      />
    </Field>
  );
}

function colorCountOptions(maximumColors: number): SelectOption[] {
  return Array.from({ length: maximumColors + 1 }, (_, count) => ({
    value: String(count),
    label: capitalize(colorCountLabel(count)),
  }));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
