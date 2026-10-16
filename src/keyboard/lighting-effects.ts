import { isValidColor, type KeyColor, type RgbColor } from "./lighting";
import type { LayeredEffectAnimator } from "./lighting-animation";

const UNRECOGNIZED_EFFECT_LABEL = "an unrecognized effect";

export type EffectParameterValue = number | boolean | RgbColor;

export type EffectValues = Readonly<Record<string, EffectParameterValue>>;

export interface ParameterDisplay {
  readonly scale: number;
  readonly decimals: number;
  readonly unit: string;
}

export interface ParameterCondition {
  readonly parameterId: string;
  readonly equals: number;
}

interface ParameterBase {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly visibleWhen?: ParameterCondition;
}

export interface SliderParameter extends ParameterBase {
  readonly kind: "slider";
  readonly min: number;
  readonly max: number;
  readonly display: ParameterDisplay;
}

export interface ChoiceOption {
  readonly value: number;
  readonly label: string;
}

export interface ChoiceParameter extends ParameterBase {
  readonly kind: "choice";
  readonly options: readonly ChoiceOption[];
  readonly presentation: "buttons" | "menu";
}

export interface ToggleParameter extends ParameterBase {
  readonly kind: "toggle";
}

export interface ColorParameter extends ParameterBase {
  readonly kind: "color";
}

export type EffectParameter = SliderParameter | ChoiceParameter | ToggleParameter | ColorParameter;

export interface EffectDescriptor {
  readonly id: string;
  readonly label: string;
  readonly parameters: readonly EffectParameter[];
  readonly defaults: EffectValues;
}

export interface EffectLayer {
  readonly effectId: string;
  readonly values: EffectValues;
}

export interface LayeredEffects {
  readonly base: EffectLayer;
  readonly effectLayers: readonly EffectLayer[];
}

export interface LightingPreset {
  readonly name: string;
  readonly keyColors: readonly KeyColor[];
}

export interface KeyColorLayer {
  readonly name: string;
  readonly editable: boolean;
  readonly explanation?: string;
}

export interface LayeredEffectCatalog {
  readonly keyColorLayers: readonly KeyColorLayer[];
  readonly baseEffects: readonly EffectDescriptor[];
  readonly layerEffects: readonly EffectDescriptor[];
  readonly maximumEffectLayers: number;
  readonly newEffectLayerId: string;
  readonly keyColorsBaseEffectId: string;
  readonly presets: readonly LightingPreset[];
  readonly animator?: LayeredEffectAnimator;
}

export class InvalidLayeredEffectsError extends Error {
  constructor(reason: string) {
    super(`The lighting effects cannot be written: ${reason}`);
    this.name = "InvalidLayeredEffectsError";
  }
}

export function layerFromDescriptor(descriptor: EffectDescriptor): EffectLayer {
  return { effectId: descriptor.id, values: descriptor.defaults };
}

export function findEffect(effects: readonly EffectDescriptor[], effectId: string): EffectDescriptor | undefined {
  return effects.find((effect) => effect.id === effectId);
}

export function isParameterVisible(parameter: EffectParameter, values: EffectValues): boolean {
  if (!parameter.visibleWhen) return true;
  return values[parameter.visibleWhen.parameterId] === parameter.visibleWhen.equals;
}

export function displayedParameterValue(parameter: SliderParameter, raw: number): string {
  const shown = (raw * parameter.display.scale).toFixed(parameter.display.decimals);
  return parameter.display.unit ? `${shown} ${parameter.display.unit}` : shown;
}

export function baseHidesKeyColors(catalog: LayeredEffectCatalog, effects: LayeredEffects): boolean {
  return effects.base.effectId !== catalog.keyColorsBaseEffectId;
}

export function describeLayeredEffects(catalog: LayeredEffectCatalog, effects: LayeredEffects): string {
  const baseLabel = findEffect(catalog.baseEffects, effects.base.effectId)?.label ?? UNRECOGNIZED_EFFECT_LABEL;
  if (effects.effectLayers.length === 0) return baseLabel;
  const layerLabels = effects.effectLayers.map(
    (layer) => findEffect(catalog.layerEffects, layer.effectId)?.label ?? UNRECOGNIZED_EFFECT_LABEL,
  );
  return `${baseLabel} with ${joinedLabels(layerLabels)}`;
}

function joinedLabels(labels: readonly string[]): string {
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

export function sameLayeredEffects(first: LayeredEffects, second: LayeredEffects): boolean {
  return layeredEffectsSignature(first) === layeredEffectsSignature(second);
}

export function assertValidLayeredEffects(catalog: LayeredEffectCatalog, effects: LayeredEffects): void {
  assertValidLayer(catalog.baseEffects, effects.base, "base layer");
  if (effects.effectLayers.length > catalog.maximumEffectLayers) {
    throw new InvalidLayeredEffectsError(
      `at most ${catalog.maximumEffectLayers} effect layers fit, not ${effects.effectLayers.length}.`,
    );
  }
  effects.effectLayers.forEach((layer, index) => {
    assertValidLayer(catalog.layerEffects, layer, `effect layer ${index + 1}`);
  });
}

function assertValidLayer(effects: readonly EffectDescriptor[], layer: EffectLayer, place: string): void {
  const descriptor = findEffect(effects, layer.effectId);
  if (!descriptor) throw new InvalidLayeredEffectsError(`"${layer.effectId}" is not an effect for the ${place}.`);
  for (const parameter of descriptor.parameters) {
    const value = layer.values[parameter.id];
    if (!isValidParameterValue(parameter, value)) {
      throw new InvalidLayeredEffectsError(
        `${parameter.label} of ${descriptor.label} on the ${place} has an invalid value.`,
      );
    }
  }
}

function isValidParameterValue(parameter: EffectParameter, value: EffectParameterValue | undefined): boolean {
  switch (parameter.kind) {
    case "slider":
      return typeof value === "number" && Number.isInteger(value) && value >= parameter.min && value <= parameter.max;
    case "choice":
      return typeof value === "number" && parameter.options.some((option) => option.value === value);
    case "toggle":
      return typeof value === "boolean";
    case "color":
      return typeof value === "object" && isValidColor(value);
  }
}

function layeredEffectsSignature(effects: LayeredEffects): string {
  return JSON.stringify([effects.base, ...effects.effectLayers].map((layer) => [
    layer.effectId,
    Object.keys(layer.values).sort().map((key) => [key, layer.values[key]]),
  ]));
}
