import type { RgbColor } from "../../keyboard/lighting";
import type { EffectLayer, EffectParameterValue, EffectValues, LayeredEffects } from "../../keyboard/lighting-effects";
import { ProtobufMessage } from "../protobuf/protobuf-message";
import { colorFromRgb565, rgb565FromColor } from "./wooting-rgb-codec";

const RGB_CORE_EFFECTS_FIELD = 4;
const EFFECTS_LAYER_FIELD = 1;
const UNKNOWN_EFFECT_PREFIX = "unknown-effect-";
const NO_EFFECT_FIELD = 0;

export const WootingEffectId = {
  static: "static",
  wave: "wave",
  cycle: "cycle",
  noise: "noise",
  spiral: "spiral",
  scan: "scan",
  breath: "breath",
  ripple: "ripple",
  trail: "trail",
  touch: "touch",
  jelly: "jelly",
  aoe: "aoe",
  mixing: "mixing",
  rtDisplay: "rt-display",
} as const;

export type WootingEffectIdValue = (typeof WootingEffectId)[keyof typeof WootingEffectId];

type FieldBinding =
  | { readonly kind: "varint"; readonly field: number }
  | { readonly kind: "bitChoice"; readonly field: number; readonly mask: number }
  | { readonly kind: "bitFlag"; readonly field: number; readonly mask: number }
  | { readonly kind: "rgb565"; readonly field: number }
  | { readonly kind: "signedMagnitude"; readonly field: number }
  | { readonly kind: "signedNegative"; readonly field: number };

interface WootingEffectEncoding {
  readonly id: WootingEffectIdValue;
  readonly fieldNumber: number;
  readonly role: "base" | "layer";
  readonly defaultLayer: Uint8Array;
  readonly bindings: Readonly<Record<string, FieldBinding>>;
}

const varint = (field: number): FieldBinding => ({ kind: "varint", field });
const bitChoice = (field: number, mask: number): FieldBinding => ({ kind: "bitChoice", field, mask });
const bitFlag = (field: number, mask: number): FieldBinding => ({ kind: "bitFlag", field, mask });
const rgb565 = (field: number): FieldBinding => ({ kind: "rgb565", field });
const signedMagnitude = (field: number): FieldBinding => ({ kind: "signedMagnitude", field });
const signedNegative = (field: number): FieldBinding => ({ kind: "signedNegative", field });

const BRIGHTNESS_AND_ANALOG_CURVE = { baseBrightness: varint(1), useAnalogCurve: bitFlag(2, 0b1) };

const WOOTING_EFFECT_ENCODINGS: readonly WootingEffectEncoding[] = [
  {
    id: WootingEffectId.wave,
    fieldNumber: 1,
    role: "base",
    defaultLayer: Uint8Array.of(0x08, 0x00, 0x10, 0x10, 0x18, 0x00),
    bindings: { look: varint(1), speed: varint(2), direction: varint(3) },
  },
  {
    id: WootingEffectId.cycle,
    fieldNumber: 4,
    role: "base",
    defaultLayer: Uint8Array.of(0x08, 0x00, 0x10, 0x30),
    bindings: { look: varint(1), speed: varint(2) },
  },
  {
    id: WootingEffectId.noise,
    fieldNumber: 14,
    role: "base",
    defaultLayer: Uint8Array.of(0x08, 0x9f, 0x30, 0x10, 0xe1, 0x0f, 0x18, 0x32, 0x20, 0x19),
    bindings: { primaryColor: rgb565(1), secondaryColor: rgb565(2), speed: varint(3), scale: varint(4) },
  },
  {
    id: WootingEffectId.spiral,
    fieldNumber: 15,
    role: "base",
    defaultLayer: Uint8Array.of(0x08, 0x9f, 0xf0, 0x03, 0x10, 0xff, 0x0f, 0x18, 0x64, 0x20, 0x8b, 0x01),
    bindings: {
      primaryColor: rgb565(1),
      secondaryColor: rgb565(2),
      spinSpeed: signedMagnitude(3),
      spinClockwise: signedNegative(3),
      spiralSpeed: signedMagnitude(4),
      spiralClockwise: signedNegative(4),
    },
  },
  {
    id: WootingEffectId.scan,
    fieldNumber: 2,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x01, 0x10, 0x0f, 0x18, 0x1e, 0x20, 0x00),
    bindings: { width: varint(1), speed: varint(2), baseBrightness: varint(3), direction: varint(4) },
  },
  {
    id: WootingEffectId.breath,
    fieldNumber: 3,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x0f, 0x18, 0x00),
    bindings: { speed: varint(1), secondaryBrightness: varint(3) },
  },
  {
    id: WootingEffectId.ripple,
    fieldNumber: 5,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x00, 0x10, 0x14, 0x18, 0x1e, 0x20, 0x1e),
    bindings: {
      randomColors: bitFlag(1, 0b001),
      inverted: bitFlag(1, 0b100),
      spreadSpeed: varint(2),
      fadeSpeed: varint(3),
      baseBrightness: varint(4),
    },
  },
  {
    id: WootingEffectId.trail,
    fieldNumber: 6,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x1e, 0x10, 0x04, 0x18, 0x00, 0x20, 0xff, 0xff, 0x03),
    bindings: {
      baseBrightness: varint(1),
      speed: varint(2),
      colorMode: bitChoice(3, 0b011),
      fadeDirection: bitChoice(3, 0b100),
      customColor: rgb565(4),
    },
  },
  {
    id: WootingEffectId.touch,
    fieldNumber: 7,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x1e, 0x10, 0x00, 0x18, 0x00, 0x20, 0x00, 0x28, 0x01),
    bindings: BRIGHTNESS_AND_ANALOG_CURVE,
  },
  {
    id: WootingEffectId.jelly,
    fieldNumber: 8,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x1e, 0x10, 0x00),
    bindings: BRIGHTNESS_AND_ANALOG_CURVE,
  },
  {
    id: WootingEffectId.aoe,
    fieldNumber: 9,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x1e, 0x10, 0x00),
    bindings: BRIGHTNESS_AND_ANALOG_CURVE,
  },
  {
    id: WootingEffectId.mixing,
    fieldNumber: 10,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x00),
    bindings: { useAnalogCurve: bitFlag(1, 0b1) },
  },
  {
    id: WootingEffectId.rtDisplay,
    fieldNumber: 11,
    role: "layer",
    defaultLayer: Uint8Array.of(0x08, 0x8c, 0x01),
    bindings: { baseBrightness: varint(1) },
  },
];

const STATIC_BASE: EffectLayer = { effectId: WootingEffectId.static, values: {} };

interface StoredLayer {
  readonly fieldNumber: number;
  readonly layer: ProtobufMessage;
  readonly content: Uint8Array;
}

export class UnknownWootingEffectError extends Error {
  constructor(effectId: string) {
    super(`OpenKeyboard does not know how to store the "${effectId}" effect on a Wooting keyboard.`);
    this.name = "UnknownWootingEffectError";
  }
}

export function wootingEffectDefaults(effectId: WootingEffectIdValue): EffectValues {
  if (effectId === WootingEffectId.static) return {};
  const encoding = encodingById(effectId);
  if (!encoding) throw new UnknownWootingEffectError(effectId);
  return decodeLayerValues(encoding, ProtobufMessage.decode(encoding.defaultLayer));
}

export function isUnknownWootingEffect(effectId: string): boolean {
  return effectId.startsWith(UNKNOWN_EFFECT_PREFIX);
}

export function decodeRgbEffects(corePayload: Uint8Array): LayeredEffects {
  let base = STATIC_BASE;
  const effectLayers: EffectLayer[] = [];
  const [storedBase, storedEffectLayers] = splitBaseLayer(storedLayers(corePayload));
  if (storedBase) {
    const encoding = encodingByFieldNumber(storedBase.fieldNumber)!;
    base = { effectId: encoding.id, values: decodeLayerValues(encoding, ProtobufMessage.decode(storedBase.content)) };
  }
  for (const stored of storedEffectLayers) {
    const encoding = encodingByFieldNumber(stored.fieldNumber);
    effectLayers.push(encoding
      ? { effectId: encoding.id, values: decodeLayerValues(encoding, ProtobufMessage.decode(stored.content)) }
      : { effectId: `${UNKNOWN_EFFECT_PREFIX}${stored.fieldNumber}`, values: {} });
  }
  return { base, effectLayers };
}

export function withRgbEffects(corePayload: Uint8Array, effects: LayeredEffects): Uint8Array {
  const [storedBase, storedEffectLayers] = splitBaseLayer(storedLayers(corePayload));
  const layers = [
    ...(effects.base.effectId === WootingEffectId.static ? [] : [encodeLayer(effects.base, storedBase)]),
    ...effects.effectLayers.map((layer, index) => encodeLayer(layer, storedEffectLayers[index])),
  ];
  const effectsMessage = ProtobufMessage.empty().withRepeatedMessages(EFFECTS_LAYER_FIELD, layers);
  return ProtobufMessage.decode(corePayload).withMessage(RGB_CORE_EFFECTS_FIELD, effectsMessage).encode();
}

function storedLayers(corePayload: Uint8Array): StoredLayer[] {
  const core = ProtobufMessage.decode(corePayload);
  if (!core.has(RGB_CORE_EFFECTS_FIELD)) return [];
  return core.message(RGB_CORE_EFFECTS_FIELD).repeatedMessages(EFFECTS_LAYER_FIELD).map(storedLayerOf);
}

function storedLayerOf(layer: ProtobufMessage): StoredLayer {
  const fieldNumber = layer.fieldNumbers()[0] ?? NO_EFFECT_FIELD;
  return { fieldNumber, layer, content: layer.bytes(fieldNumber) };
}

function splitBaseLayer(layers: readonly StoredLayer[]): [StoredLayer | undefined, StoredLayer[]] {
  const [first, ...rest] = layers;
  if (first && encodingByFieldNumber(first.fieldNumber)?.role === "base") return [first, rest];
  return [undefined, [...layers]];
}

function encodeLayer(layer: EffectLayer, stored: StoredLayer | undefined): ProtobufMessage {
  if (isUnknownWootingEffect(layer.effectId)) {
    const fieldNumber = Number(layer.effectId.slice(UNKNOWN_EFFECT_PREFIX.length));
    if (stored?.fieldNumber !== fieldNumber) throw new UnknownWootingEffectError(layer.effectId);
    return stored.layer;
  }
  const encoding = encodingById(layer.effectId);
  if (!encoding) throw new UnknownWootingEffectError(layer.effectId);
  const template = stored?.fieldNumber === encoding.fieldNumber ? stored.content : encoding.defaultLayer;
  const content = withLayerValues(encoding, ProtobufMessage.decode(template), layer.values);
  return ProtobufMessage.empty().withMessage(encoding.fieldNumber, content);
}

function decodeLayerValues(encoding: WootingEffectEncoding, content: ProtobufMessage): EffectValues {
  return Object.fromEntries(Object.entries(encoding.bindings).map(([parameterId, binding]) => [
    parameterId,
    decodeBinding(binding, content.varint(binding.field)),
  ]));
}

function decodeBinding(binding: FieldBinding, raw: number): EffectParameterValue {
  switch (binding.kind) {
    case "varint":
      return raw;
    case "bitChoice":
      return raw & binding.mask;
    case "bitFlag":
      return (raw & binding.mask) !== 0;
    case "rgb565":
      return colorFromRgb565(raw);
    case "signedMagnitude":
      return Math.abs(zigZagDecode(raw));
    case "signedNegative":
      return zigZagDecode(raw) < 0;
  }
}

function withLayerValues(
  encoding: WootingEffectEncoding,
  template: ProtobufMessage,
  values: EffectValues,
): ProtobufMessage {
  const fieldValues = new Map<number, number>();
  const current = (field: number) => fieldValues.get(field) ?? template.varint(field);
  const bindings = Object.entries(encoding.bindings)
    .filter(([parameterId]) => values[parameterId] !== undefined)
    .sort(([, first], [, second]) => signOrder(first) - signOrder(second));
  for (const [parameterId, binding] of bindings) {
    fieldValues.set(binding.field, encodeBinding(binding, current(binding.field), values[parameterId]));
  }
  let content = template;
  for (const [field, value] of fieldValues) content = content.withVarint(field, value);
  return content;
}

function signOrder(binding: FieldBinding): number {
  return binding.kind === "signedNegative" ? 1 : 0;
}

function encodeBinding(binding: FieldBinding, raw: number, value: EffectParameterValue): number {
  switch (binding.kind) {
    case "varint":
      return value as number;
    case "bitChoice":
      return (raw & ~binding.mask) | ((value as number) & binding.mask);
    case "bitFlag":
      return value ? raw | binding.mask : raw & ~binding.mask;
    case "rgb565":
      return rgb565FromColor(value as RgbColor);
    case "signedMagnitude": {
      const isNegative = zigZagDecode(raw) < 0;
      return zigZagEncode(isNegative ? -(value as number) : (value as number));
    }
    case "signedNegative": {
      const magnitude = Math.abs(zigZagDecode(raw));
      return zigZagEncode(value ? -magnitude : magnitude);
    }
  }
}

function zigZagDecode(raw: number): number {
  return raw % 2 === 0 ? raw / 2 : -(raw + 1) / 2;
}

function zigZagEncode(value: number): number {
  return value >= 0 ? value * 2 : -value * 2 - 1;
}

function encodingById(effectId: string): WootingEffectEncoding | undefined {
  return WOOTING_EFFECT_ENCODINGS.find((encoding) => encoding.id === effectId);
}

function encodingByFieldNumber(fieldNumber: number): WootingEffectEncoding | undefined {
  return WOOTING_EFFECT_ENCODINGS.find((encoding) => encoding.fieldNumber === fieldNumber);
}
