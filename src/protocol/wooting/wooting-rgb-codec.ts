import type { KeyColor, RgbColor } from "../../keyboard/lighting";
import { ProtobufMessage } from "../protobuf/protobuf-message";

const RgbCoreField = { settings: 1, effects: 4 } as const;
const RgbCoreSettingsField = { brightness: 1 } as const;
const RgbRowsField = { row: 1, colors: 1 } as const;

const MAXIMUM_BRIGHTNESS_RAW = 0xff;
const PERCENT = 100;
const RED_SHIFT = 11;
const GREEN_SHIFT = 5;
const FIVE_BIT_MASK = 0x1f;
const SIX_BIT_MASK = 0x3f;
const MAXIMUM_CHANNEL_VALUE = 0xff;

export interface WootingRgbCore {
  readonly brightnessPercent: number;
  readonly hasEffectLayers: boolean;
}

export function decodeRgbCore(payload: Uint8Array): WootingRgbCore {
  const core = ProtobufMessage.decode(payload);
  const settings = core.message(RgbCoreField.settings);
  const brightnessRaw = settings.has(RgbCoreSettingsField.brightness)
    ? settings.varint(RgbCoreSettingsField.brightness)
    : MAXIMUM_BRIGHTNESS_RAW;
  return {
    brightnessPercent: Math.round((brightnessRaw / MAXIMUM_BRIGHTNESS_RAW) * PERCENT),
    hasEffectLayers: core.has(RgbCoreField.effects) && core.bytes(RgbCoreField.effects).length > 0,
  };
}

export function decodeRgbRows(payload: Uint8Array, firstRow: number): KeyColor[] {
  return ProtobufMessage.decode(payload)
    .repeatedMessages(RgbRowsField.row)
    .flatMap((row, rowOffset) => row.repeatedVarints(RgbRowsField.colors).map((rgb565, column) => ({
      matrixRow: firstRow + rowOffset,
      matrixColumn: column,
      color: colorFromRgb565(rgb565),
    })));
}

export function colorFromRgb565(rgb565: number): RgbColor {
  return {
    red: scaleChannel((rgb565 >> RED_SHIFT) & FIVE_BIT_MASK, FIVE_BIT_MASK),
    green: scaleChannel((rgb565 >> GREEN_SHIFT) & SIX_BIT_MASK, SIX_BIT_MASK),
    blue: scaleChannel(rgb565 & FIVE_BIT_MASK, FIVE_BIT_MASK),
  };
}

function scaleChannel(value: number, maximum: number): number {
  return Math.round((value / maximum) * MAXIMUM_CHANNEL_VALUE);
}
