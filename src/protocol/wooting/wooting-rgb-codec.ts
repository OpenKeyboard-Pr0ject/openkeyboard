import type { KeyColor, RgbColor } from "../../keyboard/lighting";
import type { MatrixPosition } from "../../keyboard/physical-layout";
import { ProtobufMessage } from "../protobuf/protobuf-message";

const RgbCoreField = { settings: 1, effects: 4 } as const;
const RgbCoreSettingsField = { brightness: 1 } as const;
const RgbRowsField = { row: 1, colors: 1 } as const;

const MAXIMUM_BRIGHTNESS_RAW = 0xff;
const ROWS_PER_REPORT = 3;
const COLUMNS_PER_ROW = 21;
const PERCENT = 100;
const RED_SHIFT = 11;
const GREEN_SHIFT = 5;
const FIVE_BIT_MASK = 0x1f;
const SIX_BIT_MASK = 0x3f;
const MAXIMUM_CHANNEL_VALUE = 0xff;
const RED_DROPPED_BITS = 3;
const GREEN_DROPPED_BITS = 2;
const BLUE_DROPPED_BITS = 3;
const BYTES_PER_FRAME_COLOR = 2;

export interface WootingRgbFrameShape {
  readonly rows: number;
  readonly columns: number;
}

export class IncompleteRgbFrameError extends Error {
  constructor(byteLength: number, shape: WootingRgbFrameShape) {
    super(`The lighting frame holds ${byteLength} bytes, too few for ${shape.rows} rows of ${shape.columns} keys.`);
    this.name = "IncompleteRgbFrameError";
  }
}

export interface WootingRgbCore {
  readonly brightnessPercent: number;
  readonly hasEffectLayers: boolean;
}

export function decodeRgbCore(payload: Uint8Array): WootingRgbCore {
  const core = ProtobufMessage.decode(payload);
  const brightnessRaw = rgbCoreBrightnessRaw(payload);
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

export function decodeRgbFrame(payload: Uint8Array, shape: WootingRgbFrameShape): KeyColor[] {
  const colorCount = shape.rows * shape.columns;
  if (payload.length < colorCount * BYTES_PER_FRAME_COLOR) throw new IncompleteRgbFrameError(payload.length, shape);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return Array.from({ length: colorCount }, (_, index) => ({
    matrixRow: Math.floor(index / shape.columns),
    matrixColumn: index % shape.columns,
    color: colorFromRgb565(view.getUint16(index * BYTES_PER_FRAME_COLOR, true)),
  }));
}

export function brightnessRawFromPercent(percent: number): number {
  return Math.round((percent / PERCENT) * MAXIMUM_BRIGHTNESS_RAW);
}

export function rgbCoreBrightnessRaw(payload: Uint8Array): number {
  const settings = ProtobufMessage.decode(payload).message(RgbCoreField.settings);
  return settings.has(RgbCoreSettingsField.brightness)
    ? settings.varint(RgbCoreSettingsField.brightness)
    : MAXIMUM_BRIGHTNESS_RAW;
}

export function withRgbCoreBrightness(payload: Uint8Array, brightnessRaw: number): Uint8Array {
  const core = ProtobufMessage.decode(payload);
  const settings = core.message(RgbCoreField.settings).withVarint(RgbCoreSettingsField.brightness, brightnessRaw);
  return core.withMessage(RgbCoreField.settings, settings).encode();
}

export function rgbRowValues(payload: Uint8Array): number[][] {
  return ProtobufMessage.decode(payload)
    .repeatedMessages(RgbRowsField.row)
    .map((row) => row.repeatedVarints(RgbRowsField.colors));
}

export function rgbRowsAreComplete(payload: Uint8Array): boolean {
  try {
    const rows = rgbRowValues(payload);
    return rows.length === ROWS_PER_REPORT && rows.every((row) => row.length === COLUMNS_PER_ROW);
  } catch {
    return false;
  }
}

export function withRgbRowColors(payload: Uint8Array, firstRow: number, keyColors: readonly KeyColor[]): Uint8Array {
  const message = ProtobufMessage.decode(payload);
  const rows = message.repeatedMessages(RgbRowsField.row).map((row, rowOffset) => {
    const changes = keyColors.filter((keyColor) => keyColor.matrixRow === firstRow + rowOffset);
    if (changes.length === 0) return row;
    const values = row.repeatedVarints(RgbRowsField.colors);
    for (const change of changes) {
      if (change.matrixColumn >= values.length) throw new KeyColorOutsideRowError(change);
      values[change.matrixColumn] = rgb565FromColor(change.color);
    }
    return row.withPackedVarints(RgbRowsField.colors, values);
  });
  return message.withRepeatedMessages(RgbRowsField.row, rows).encode();
}

export class KeyColorOutsideRowError extends Error {
  constructor(position: MatrixPosition) {
    super(`The keyboard stores no color for row ${position.matrixRow}, column ${position.matrixColumn}.`);
    this.name = "KeyColorOutsideRowError";
  }
}

export function rgb565FromColor(color: RgbColor): number {
  return ((color.red >> RED_DROPPED_BITS) << RED_SHIFT)
    | ((color.green >> GREEN_DROPPED_BITS) << GREEN_SHIFT)
    | (color.blue >> BLUE_DROPPED_BITS);
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
