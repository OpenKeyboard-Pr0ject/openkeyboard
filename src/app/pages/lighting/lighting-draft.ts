import {
  colorFromHex,
  colorToHex,
  type KeyColor,
  type LightingChange,
  type LightingState,
} from "../../../keyboard/lighting";
import {
  type EffectLayer,
  type EffectParameterValue,
  findEffect,
  type LayeredEffectCatalog,
  type LayeredEffects,
  layerFromDescriptor,
  type LightingPreset,
  sameLayeredEffects,
} from "../../../keyboard/lighting-effects";
import { matrixKeyId, matrixPositionFromKeyId } from "../../../keyboard/physical-layout";

export interface LightingDraft {
  readonly brightnessPercent: number;
  readonly keyColors: ReadonlyMap<string, string>;
  readonly effects: LayeredEffects;
}

export type LayerSelection =
  | { readonly kind: "base" }
  | { readonly kind: "effect-layer"; readonly index: number };

export const BASE_LAYER_SELECTION: LayerSelection = { kind: "base" };

export class UnknownEffectError extends Error {
  constructor(effectId: string) {
    super(`"${effectId}" is not an effect this keyboard offers.`);
    this.name = "UnknownEffectError";
  }
}

export function draftFromState(state: LightingState, catalog: LayeredEffectCatalog): LightingDraft {
  return {
    brightnessPercent: state.brightnessPercent,
    keyColors: new Map((state.keyColors ?? []).map((keyColor) => [matrixKeyId(keyColor), colorToHex(keyColor.color)])),
    effects: state.layeredEffects ?? {
      base: layerFromDescriptor(requireEffect(catalog.baseEffects, catalog.keyColorsBaseEffectId)),
      effectLayers: [],
    },
  };
}

export function withBrightness(draft: LightingDraft, brightnessPercent: number): LightingDraft {
  return { ...draft, brightnessPercent };
}

export function withKeyColor(draft: LightingDraft, keyIds: Iterable<string>, color: string): LightingDraft {
  const keyColors = new Map(draft.keyColors);
  for (const keyId of keyIds) keyColors.set(keyId, color);
  return { ...draft, keyColors };
}

export function withBaseEffect(draft: LightingDraft, catalog: LayeredEffectCatalog, effectId: string): LightingDraft {
  if (draft.effects.base.effectId === effectId) return draft;
  const base = layerFromDescriptor(requireEffect(catalog.baseEffects, effectId));
  return { ...draft, effects: { ...draft.effects, base } };
}

export function canAddEffectLayer(draft: LightingDraft, catalog: LayeredEffectCatalog): boolean {
  return draft.effects.effectLayers.length < catalog.maximumEffectLayers;
}

export function withAddedEffectLayer(draft: LightingDraft, catalog: LayeredEffectCatalog): LightingDraft {
  if (!canAddEffectLayer(draft, catalog)) return draft;
  const layer = layerFromDescriptor(requireEffect(catalog.layerEffects, catalog.newEffectLayerId));
  return withEffectLayers(draft, [...draft.effects.effectLayers, layer]);
}

export function withoutEffectLayer(draft: LightingDraft, index: number): LightingDraft {
  return withEffectLayers(draft, draft.effects.effectLayers.filter((_, position) => position !== index));
}

export function withLayerEffect(
  draft: LightingDraft,
  catalog: LayeredEffectCatalog,
  index: number,
  effectId: string,
): LightingDraft {
  const current = draft.effects.effectLayers[index];
  if (!current || current.effectId === effectId) return draft;
  const layer = layerFromDescriptor(requireEffect(catalog.layerEffects, effectId));
  return withEffectLayers(draft, replaced(draft.effects.effectLayers, index, layer));
}

export function withParameterValue(
  draft: LightingDraft,
  selection: LayerSelection,
  parameterId: string,
  value: EffectParameterValue,
): LightingDraft {
  const layer = selectedLayer(draft, selection);
  if (!layer) return draft;
  const edited: EffectLayer = { ...layer, values: { ...layer.values, [parameterId]: value } };
  if (selection.kind === "base") return { ...draft, effects: { ...draft.effects, base: edited } };
  return withEffectLayers(draft, replaced(draft.effects.effectLayers, selection.index, edited));
}

export function withPreset(draft: LightingDraft, catalog: LayeredEffectCatalog, preset: LightingPreset): LightingDraft {
  const keyColors = new Map(draft.keyColors);
  for (const keyColor of preset.keyColors) keyColors.set(matrixKeyId(keyColor), colorToHex(keyColor.color));
  const base = layerFromDescriptor(requireEffect(catalog.baseEffects, catalog.keyColorsBaseEffectId));
  return { ...draft, keyColors, effects: { base, effectLayers: [] } };
}

export function selectedLayer(draft: LightingDraft, selection: LayerSelection): EffectLayer | undefined {
  return selection.kind === "base" ? draft.effects.base : draft.effects.effectLayers[selection.index];
}

export function selectionAfterRemoving(selection: LayerSelection, removedIndex: number): LayerSelection {
  if (selection.kind === "base" || selection.index < removedIndex) return selection;
  if (selection.index === removedIndex) return BASE_LAYER_SELECTION;
  return { kind: "effect-layer", index: selection.index - 1 };
}

export function lightingChangeFromDraft(stored: LightingDraft, draft: LightingDraft): LightingChange {
  const keyColors = [...draft.keyColors].flatMap(([keyId, color]): KeyColor[] => {
    if (stored.keyColors.get(keyId) === color) return [];
    return [{ ...matrixPositionFromKeyId(keyId), color: colorFromHex(color) }];
  });
  return {
    ...(draft.brightnessPercent !== stored.brightnessPercent ? { brightnessPercent: draft.brightnessPercent } : {}),
    ...(keyColors.length > 0 ? { keyColors } : {}),
    ...(sameLayeredEffects(draft.effects, stored.effects) ? {} : { layeredEffects: draft.effects }),
  };
}

export function hasChanges(stored: LightingDraft, draft: LightingDraft): boolean {
  return Object.keys(lightingChangeFromDraft(stored, draft)).length > 0;
}

function withEffectLayers(draft: LightingDraft, effectLayers: readonly EffectLayer[]): LightingDraft {
  return { ...draft, effects: { ...draft.effects, effectLayers } };
}

function replaced<Item>(items: readonly Item[], index: number, item: Item): Item[] {
  return items.map((existing, position) => (position === index ? item : existing));
}

function requireEffect(effects: LayeredEffectCatalog["baseEffects"], effectId: string) {
  const descriptor = findEffect(effects, effectId);
  if (!descriptor) throw new UnknownEffectError(effectId);
  return descriptor;
}
