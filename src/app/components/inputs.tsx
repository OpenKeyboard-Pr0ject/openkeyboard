import type { ReactNode } from "react";

const CONTROL_CLASSES = [
  "h-9 rounded-lg border border-line bg-raised px-3 text-sm text-fg",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

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
    <label className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
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
        checked ? "bg-accent" : "bg-line",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
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
    <span className="flex w-64 max-w-full items-center gap-3">
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
      <output className="w-12 text-right text-sm tabular-nums text-muted">{valueLabel}</output>
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
      className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-raised p-1 disabled:cursor-not-allowed"
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
