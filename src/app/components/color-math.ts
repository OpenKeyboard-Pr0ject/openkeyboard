import type { RgbColor } from "../../keyboard/lighting";

export interface HsvColor {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
}

const MAXIMUM_CHANNEL_VALUE = 255;
const FULL_TURN_DEGREES = 360;
const SECTOR_DEGREES = 60;
const SECTOR_COUNT = 6;

export function hsvFromRgb(color: RgbColor): HsvColor {
  const red = color.red / MAXIMUM_CHANNEL_VALUE;
  const green = color.green / MAXIMUM_CHANNEL_VALUE;
  const blue = color.blue / MAXIMUM_CHANNEL_VALUE;
  const brightest = Math.max(red, green, blue);
  const spread = brightest - Math.min(red, green, blue);
  return {
    hue: hueOf(red, green, blue, brightest, spread),
    saturation: brightest === 0 ? 0 : spread / brightest,
    value: brightest,
  };
}

export function rgbFromHsv(color: HsvColor): RgbColor {
  const hue = ((color.hue % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  const chroma = color.value * color.saturation;
  const position = hue / SECTOR_DEGREES;
  const secondary = chroma * (1 - Math.abs((position % 2) - 1));
  const lightest = color.value - chroma;
  const sector = Math.floor(position) % SECTOR_COUNT;
  const [red, green, blue] = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector];
  return {
    red: toChannel(red + lightest),
    green: toChannel(green + lightest),
    blue: toChannel(blue + lightest),
  };
}

function hueOf(red: number, green: number, blue: number, brightest: number, spread: number): number {
  if (spread === 0) return 0;
  let sectorPosition: number;
  if (brightest === red) sectorPosition = ((green - blue) / spread + SECTOR_COUNT) % SECTOR_COUNT;
  else if (brightest === green) sectorPosition = (blue - red) / spread + 2;
  else sectorPosition = (red - green) / spread + 4;
  return sectorPosition * SECTOR_DEGREES;
}

function toChannel(fraction: number): number {
  return Math.round(fraction * MAXIMUM_CHANNEL_VALUE);
}
