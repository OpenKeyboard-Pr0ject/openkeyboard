import { colorFromHex, colorToHex, type RgbColor } from "../../../keyboard/lighting";
import {
  type ChoiceParameter,
  displayedParameterValue,
  type EffectDescriptor,
  type EffectParameter,
  type EffectParameterValue,
  type EffectValues,
  isParameterVisible,
} from "../../../keyboard/lighting-effects";
import { InfoIcon } from "../../components/icons";
import { ColorInput, RangeInput, SelectInput, Toggle } from "../../components/inputs";

interface EffectParameterControlsProps {
  readonly descriptor: EffectDescriptor;
  readonly values: EffectValues;
  readonly disabled: boolean;
  readonly onChange: (parameterId: string, value: EffectParameterValue) => void;
}

export function EffectParameterControls({ descriptor, values, disabled, onChange }: EffectParameterControlsProps) {
  const visible = descriptor.parameters.filter((parameter) => isParameterVisible(parameter, values));
  if (visible.length === 0) {
    return <p className="m-0 text-sm text-muted">{descriptor.label} has no settings.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {visible.map((parameter) => (
        <ParameterControl
          key={parameter.id}
          parameter={parameter}
          value={values[parameter.id] ?? descriptor.defaults[parameter.id]}
          disabled={disabled}
          onChange={(value) => onChange(parameter.id, value)}
        />
      ))}
    </div>
  );
}

interface ParameterControlProps {
  readonly parameter: EffectParameter;
  readonly value: EffectParameterValue;
  readonly disabled: boolean;
  readonly onChange: (value: EffectParameterValue) => void;
}

function ParameterControl({ parameter, value, disabled, onChange }: ParameterControlProps) {
  switch (parameter.kind) {
    case "slider":
      return (
        <div className="flex flex-col gap-1">
          <ParameterLabel parameter={parameter} />
          <RangeInput
            label={parameter.label}
            value={value as number}
            range={{ min: parameter.min, max: parameter.max, step: 1 }}
            valueLabel={displayedParameterValue(parameter, value as number)}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      );
    case "choice":
      return (
        <div className="flex flex-col gap-1">
          <ParameterLabel parameter={parameter} />
          <ChoiceControl parameter={parameter} value={value as number} disabled={disabled} onChange={onChange} />
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between gap-3">
          <ParameterLabel parameter={parameter} />
          <Toggle label={parameter.label} checked={value as boolean} disabled={disabled} onChange={onChange} />
        </div>
      );
    case "color":
      return (
        <div className="flex items-center justify-between gap-3">
          <ParameterLabel parameter={parameter} />
          <ColorInput
            label={parameter.label}
            value={colorToHex(value as RgbColor)}
            disabled={disabled}
            onChange={(hex) => onChange(colorFromHex(hex))}
          />
        </div>
      );
  }
}

interface ChoiceControlProps {
  readonly parameter: ChoiceParameter;
  readonly value: number;
  readonly disabled: boolean;
  readonly onChange: (value: number) => void;
}

function ChoiceControl({ parameter, value, disabled, onChange }: ChoiceControlProps) {
  if (parameter.presentation === "menu") {
    return (
      <SelectInput
        label={parameter.label}
        value={String(value)}
        options={parameter.options.map((option) => ({ value: String(option.value), label: option.label }))}
        disabled={disabled}
        onChange={(selected) => onChange(Number(selected))}
      />
    );
  }
  return (
    <div role="radiogroup" aria-label={parameter.label} className="flex flex-wrap gap-1 rounded-md bg-sunken p-1">
      {parameter.options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              "h-8 flex-1 rounded px-3 text-sm font-semibold whitespace-nowrap transition",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isSelected ? "bg-accent text-on-accent" : "text-fg hover:bg-tint",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ParameterLabel({ parameter }: { readonly parameter: EffectParameter }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-fg">
      {parameter.label}
      {parameter.hint && (
        <span title={parameter.hint} aria-label={parameter.hint} className="text-muted">
          <InfoIcon width={14} height={14} />
        </span>
      )}
    </span>
  );
}
