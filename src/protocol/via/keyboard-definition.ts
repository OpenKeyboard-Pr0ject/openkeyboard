import type { PhysicalKey } from "../../keyboard/keymap";
import { parseKleKeys, type KleKey } from "./kle-layout";

const MATRIX_LABEL_SLOT = 0;
const ENCODER_LABEL_SLOT = 4;
const LAYOUT_OPTION_LABEL_SLOT = 8;
const ENCODER_MARKER = "e";

export class KeyboardDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyboardDefinitionError";
  }
}

interface LayoutOptionChoice {
  readonly option: number;
  readonly choice: number;
}

interface DefinitionKey extends PhysicalKey {
  readonly layoutOption?: LayoutOptionChoice;
}

export interface KeyboardDefinition {
  readonly name: string;
  readonly matrixRows: number;
  readonly matrixColumns: number;
  readonly layoutOptionSizes: readonly number[];
  readonly keys: readonly DefinitionKey[];
}

interface DefinitionJson {
  readonly name?: unknown;
  readonly matrix?: { readonly rows?: unknown; readonly cols?: unknown };
  readonly layouts?: { readonly labels?: unknown; readonly keymap?: unknown };
}

export function parseKeyboardDefinition(definitionJson: string): KeyboardDefinition {
  const definition = parseJsonObject(definitionJson);
  return {
    name: typeof definition.name === "string" ? definition.name : "",
    matrixRows: positiveInteger(definition.matrix?.rows, "matrix.rows"),
    matrixColumns: positiveInteger(definition.matrix?.cols, "matrix.cols"),
    layoutOptionSizes: layoutOptionSizes(definition.layouts?.labels),
    keys: parseKleKeys(definition.layouts?.keymap).filter(isMatrixKey).map(toDefinitionKey),
  };
}

export function visiblePhysicalKeys(definition: KeyboardDefinition, packedLayoutOptions: number): PhysicalKey[] {
  const selectedChoices = unpackLayoutOptions(definition.layoutOptionSizes, packedLayoutOptions);
  const visibleKeys = definition.keys.filter(
    (key) => !key.layoutOption || selectedChoices[key.layoutOption.option] === key.layoutOption.choice,
  );
  return alignToOrigin(visibleKeys);
}

export function unpackLayoutOptions(optionSizes: readonly number[], packedLayoutOptions: number): number[] {
  const choices = Array.from(optionSizes, () => 0);
  let remaining = packedLayoutOptions >>> 0;
  for (let option = optionSizes.length - 1; option >= 0; option -= 1) {
    const bits = bitsForChoices(optionSizes[option]);
    choices[option] = remaining & ((1 << bits) - 1);
    remaining >>>= bits;
  }
  return choices;
}

function bitsForChoices(choiceCount: number): number {
  return Math.ceil(Math.log2(Math.max(choiceCount, 1)));
}

function layoutOptionSizes(labels: unknown): number[] {
  if (labels === undefined) return [];
  if (!Array.isArray(labels)) throw new KeyboardDefinitionError("layouts.labels must be an array.");
  return labels.map((label) => (Array.isArray(label) ? label.length - 1 : 2));
}

function isMatrixKey(key: KleKey): boolean {
  return !key.decal && key.labels[ENCODER_LABEL_SLOT] !== ENCODER_MARKER && /^\d+,\d+$/.test(key.labels[MATRIX_LABEL_SLOT]);
}

function toDefinitionKey(key: KleKey): DefinitionKey {
  const [matrixRow, matrixColumn] = key.labels[MATRIX_LABEL_SLOT].split(",").map(Number);
  const layoutOption = parseLayoutOption(key.labels[LAYOUT_OPTION_LABEL_SLOT]);
  return {
    x: key.x,
    y: key.y,
    width: key.width,
    height: key.height,
    matrixRow,
    matrixColumn,
    ...(layoutOption ? { layoutOption } : {}),
  };
}

function parseLayoutOption(label: string): LayoutOptionChoice | undefined {
  if (!/^\d+,\d+$/.test(label)) return undefined;
  const [option, choice] = label.split(",").map(Number);
  return { option, choice };
}

function alignToOrigin(keys: readonly DefinitionKey[]): PhysicalKey[] {
  const left = Math.min(...keys.map((key) => key.x));
  const top = Math.min(...keys.map((key) => key.y));
  return keys.map(({ layoutOption: _layoutOption, ...key }) => ({ ...key, x: key.x - left, y: key.y - top }));
}

function parseJsonObject(definitionJson: string): DefinitionJson {
  try {
    const parsed: unknown = JSON.parse(definitionJson);
    if (typeof parsed !== "object" || parsed === null) throw new KeyboardDefinitionError("The definition is not an object.");
    return parsed as DefinitionJson;
  } catch (error) {
    if (error instanceof KeyboardDefinitionError) throw error;
    throw new KeyboardDefinitionError("The definition file is not valid JSON.");
  }
}

function positiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new KeyboardDefinitionError(`The definition needs a positive whole number in ${fieldName}.`);
  }
  return value;
}
