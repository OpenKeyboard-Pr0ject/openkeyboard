import type { ReactNode } from "react";

const CONTROL_CLASSES = [
  "h-10 rounded-md border border-line bg-sunken px-3 text-base text-strong",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const RANGE_VALUE_CLASSES =
  "w-20 rounded-md bg-sunken px-2 py-1 text-right text-sm whitespace-nowrap tabular-nums text-strong";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface FieldProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-base">
      <span className="text-fg">{label}</span>
      {children}
    </label>
  );
}

interface SelectInputProps {
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly className?: string;
}

export function SelectInput({ value, options, onChange, disabled, label, className = "" }: SelectInputProps) {
  return (
    <select
      className={`${CONTROL_CLASSES} pr-8 ${className}`}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface NumberInputProps {
  readonly value: string;
  readonly range: { readonly min: number; readonly max: number; readonly step: number };
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly label?: string;
}

export function NumberInput({ value, range, onChange, disabled, label }: NumberInputProps) {
  return (
    <input
      type="number"
      className={`${CONTROL_CLASSES} w-24 tabular-nums`}
      min={range.min}
      max={range.max}
      step={range.step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly label: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-accent" : "bg-tint-strong",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow transition-transform",
          checked ? "translate-x-5 bg-on-accent" : "translate-x-0 bg-faint",
        ].join(" ")}
      />
    </button>
  );
}

interface RangeInputProps {
  readonly value: number;
  readonly range: { readonly min: number; readonly max: number; readonly step: number };
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
  readonly label: string;
  readonly valueLabel: string;
}

export function RangeInput({ value, range, onChange, disabled, label, valueLabel }: RangeInputProps) {
  return (
    <span className="flex w-72 max-w-full items-center gap-3">
      <input
        type="range"
        className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--app-accent)] disabled:cursor-not-allowed"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
      <output className={RANGE_VALUE_CLASSES}>
        {valueLabel}
      </output>
    </span>
  );
}

interface ColorInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly label: string;
}

export function ColorInput({ value, onChange, disabled, label }: ColorInputProps) {
  return (
    <input
      type="color"
      className="h-10 w-14 cursor-pointer rounded-md border border-line bg-sunken p-1 disabled:cursor-not-allowed"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface RadioChoice<Value extends string> {
  readonly value: Value;
  readonly label: string;
  readonly icon?: ReactNode;
}

interface RadioListProps<Value extends string> {
  readonly label: string;
  readonly choices: readonly RadioChoice<Value>[];
  readonly selected: Value;
  readonly onSelect: (value: Value) => void;
}

export function RadioList<Value extends string>({ label, choices, selected, onSelect }: RadioListProps<Value>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {choices.map((choice) => {
        const isSelected = choice.value === selected;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(choice.value)}
            className={[
              "flex h-10 items-center gap-3 rounded-md px-3 text-left text-base transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              isSelected ? "bg-tint-strong text-strong" : "bg-subtle text-fg hover:bg-tint",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                isSelected ? "bg-accent" : "bg-tint-strong",
              ].join(" ")}
            >
              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-on-accent" />}
            </span>
            {choice.icon}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
