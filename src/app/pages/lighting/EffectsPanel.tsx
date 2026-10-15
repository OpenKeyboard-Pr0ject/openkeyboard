import { BRIGHTNESS_PERCENT_RANGE } from "../../../keyboard/lighting";
import {
  baseHidesKeyColors,
  type EffectDescriptor,
  type EffectLayer,
  findEffect,
  type LayeredEffectCatalog,
} from "../../../keyboard/lighting-effects";
import { SectionLabel } from "../../components/Card";
import { Callout } from "../../components/feedback";
import { CloseIcon, PlusIcon } from "../../components/icons";
import { RangeInput, SelectInput } from "../../components/inputs";
import {
  canAddEffectLayer,
  type LayerSelection,
  type LightingDraft,
  selectedLayer,
  selectionAfterRemoving,
  withAddedEffectLayer,
  withBaseEffect,
  withBrightness,
  withLayerEffect,
  withoutEffectLayer,
  withParameterValue,
  withPreset,
} from "./lighting-draft";
import { EffectParameterControls } from "./EffectParameterControls";

export const BASE_EFFECT_COVERS_KEYS_TITLE = "You have selected a base effect other than Static";
export const BASE_EFFECT_COVERS_KEYS_EXPLANATION = "The colors of the effect replace the colors of the keys. "
  + "Select Static to show the key colors again.";
const PRESET_PLACEHOLDER = "";
const UNRECOGNIZED_LAYER_LABEL = "Unrecognized effect";
const UNRECOGNIZED_LAYER_EXPLANATION = "OpenKeyboard does not know this effect yet and keeps it as it is. "
  + "Choose an effect to replace it.";

interface EffectsPanelProps {
  readonly catalog: LayeredEffectCatalog;
  readonly draft: LightingDraft;
  readonly selection: LayerSelection;
  readonly disabled: boolean;
  readonly onSelect: (selection: LayerSelection) => void;
  readonly onEdit: (change: (draft: LightingDraft) => LightingDraft) => void;
}

export function EffectsPanel({ catalog, draft, selection, disabled, onSelect, onEdit }: EffectsPanelProps) {
  const layer = selectedLayer(draft, selection);
  const effectChoices = selection.kind === "base" ? catalog.baseEffects : catalog.layerEffects;
  const descriptor = layer && findEffect(effectChoices, layer.effectId);

  const chooseEffect = (effectId: string) => onEdit((current) => (selection.kind === "base"
    ? withBaseEffect(current, catalog, effectId)
    : withLayerEffect(current, catalog, selection.index, effectId)));

  const addLayer = () => {
    onEdit((current) => withAddedEffectLayer(current, catalog));
    onSelect({ kind: "effect-layer", index: draft.effects.effectLayers.length });
  };

  const removeLayer = (index: number) => {
    onEdit((current) => withoutEffectLayer(current, index));
    onSelect(selectionAfterRemoving(selection, index));
  };

  return (
    <div className="@container flex flex-col gap-5">
      <div className="grid gap-4 @lg:grid-cols-2">
        <div>
          <SectionLabel>Presets</SectionLabel>
          <SelectInput
            label="Presets"
            value={PRESET_PLACEHOLDER}
            disabled={disabled}
            className="w-full"
            options={[
              { value: PRESET_PLACEHOLDER, label: "Pick a preset" },
              ...catalog.presets.map((preset) => ({ value: preset.name, label: preset.name })),
            ]}
            onChange={(name) => {
              const preset = catalog.presets.find((candidate) => candidate.name === name);
              if (!preset) return;
              onEdit((current) => withPreset(current, catalog, preset));
              onSelect({ kind: "base" });
            }}
          />
        </div>
        <div>
          <SectionLabel>Global brightness</SectionLabel>
          <RangeInput
            label="Global brightness"
            value={draft.brightnessPercent}
            range={BRIGHTNESS_PERCENT_RANGE}
            valueLabel={`${draft.brightnessPercent} %`}
            disabled={disabled}
            onChange={(percent) => onEdit((current) => withBrightness(current, percent))}
          />
        </div>
      </div>
      {baseHidesKeyColors(catalog, draft.effects) && (
        <Callout tone="warning" title={BASE_EFFECT_COVERS_KEYS_TITLE}>
          <p className="m-0">{BASE_EFFECT_COVERS_KEYS_EXPLANATION}</p>
        </Callout>
      )}
      <div className="grid gap-4 @xl:grid-cols-3">
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Base layer</SectionLabel>
            <LayerChip
              label={labelOf(catalog.baseEffects, draft.effects.base)}
              isSelected={selection.kind === "base"}
              onSelect={() => onSelect({ kind: "base" })}
            />
          </div>
          <div>
            <SectionLabel>Effect layers</SectionLabel>
            <div className="flex flex-col gap-2">
              {draft.effects.effectLayers.map((effectLayer, index) => (
                <LayerChip
                  key={index}
                  label={labelOf(catalog.layerEffects, effectLayer)}
                  isSelected={selection.kind === "effect-layer" && selection.index === index}
                  onSelect={() => onSelect({ kind: "effect-layer", index })}
                  onRemove={disabled ? undefined : () => removeLayer(index)}
                />
              ))}
              <button
                type="button"
                disabled={disabled || !canAddEffectLayer(draft, catalog)}
                title={canAddEffectLayer(draft, catalog)
                  ? undefined
                  : `A profile holds at most ${catalog.maximumEffectLayers} effect layers.`}
                onClick={addLayer}
                className="flex h-10 items-center gap-2 rounded-md border border-dashed border-line px-3 text-sm
                  text-muted transition hover:bg-tint hover:text-strong disabled:cursor-not-allowed
                  disabled:opacity-50"
              >
                <PlusIcon width={14} height={14} />
                Add RGB Fx Layer
              </button>
            </div>
          </div>
        </div>
        <div>
          <SectionLabel>Effect selection</SectionLabel>
          <div
            role="radiogroup"
            aria-label="Effect selection"
            className="grid grid-cols-2 gap-1 rounded-md bg-sunken p-1"
          >
            {effectChoices.map((effect) => (
              <EffectButton
                key={effect.id}
                effect={effect}
                isSelected={layer?.effectId === effect.id}
                disabled={disabled}
                onSelect={() => chooseEffect(effect.id)}
              />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Effect parameters</SectionLabel>
          <div className="rounded-md bg-sunken p-3">
            {descriptor && layer ? (
              <EffectParameterControls
                descriptor={descriptor}
                values={layer.values}
                disabled={disabled}
                onChange={(parameterId, value) => onEdit(
                  (current) => withParameterValue(current, selection, parameterId, value),
                )}
              />
            ) : <p className="m-0 text-sm text-muted">{UNRECOGNIZED_LAYER_EXPLANATION}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

interface LayerChipProps {
  readonly label: string;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onRemove?: () => void;
}

function LayerChip({ label, isSelected, onSelect, onRemove }: LayerChipProps) {
  return (
    <div
      className={[
        "flex h-10 items-center rounded-md border transition",
        isSelected ? "border-accent bg-tint" : "border-transparent bg-sunken hover:bg-tint",
      ].join(" ")}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className="h-full min-w-0 flex-1 truncate rounded-md px-3 text-left text-sm font-semibold text-strong
          focus-visible:outline-2 focus-visible:outline-accent"
      >
        {label}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove the ${label} layer`}
          onClick={onRemove}
          className="mr-1 flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-tint-strong
            hover:text-strong focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CloseIcon width={14} height={14} />
        </button>
      )}
    </div>
  );
}

interface EffectButtonProps {
  readonly effect: EffectDescriptor;
  readonly isSelected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

function EffectButton({ effect, isSelected, disabled, onSelect }: EffectButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        "h-9 rounded px-3 text-left text-sm font-semibold transition",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isSelected ? "bg-accent text-on-accent" : "text-fg hover:bg-tint",
      ].join(" ")}
    >
      {effect.label}
    </button>
  );
}

function labelOf(effects: readonly EffectDescriptor[], layer: EffectLayer): string {
  return findEffect(effects, layer.effectId)?.label ?? UNRECOGNIZED_LAYER_LABEL;
}
