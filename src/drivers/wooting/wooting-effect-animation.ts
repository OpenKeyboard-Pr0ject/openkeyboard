import { colorFromHex, type RgbColor } from "../../keyboard/lighting";
import type {
  AnimatedKey,
  KeyPress,
  LayeredEffectAnimator,
  LightingFrameRequest,
} from "../../keyboard/lighting-animation";
import type { EffectLayer, EffectValues, LayeredEffects } from "../../keyboard/lighting-effects";
import { WootingEffectId } from "../../protocol/wooting/wooting-rgb-effects-codec";

const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };
const WHITE: RgbColor = { red: 255, green: 255, blue: 255 };
const MAXIMUM_CHANNEL_VALUE = 255;
const RAW_BRIGHTNESS_MAXIMUM = 255;
const RAW_PERCENT_MAXIMUM = 100;
const SPIRAL_SPEED_MAXIMUM = 127;
const FULL_TURN_RADIANS = Math.PI * 2;
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;

const SECONDS_PER_SPEED_STEP = 0.25;
const RIPPLE_FADE_SECONDS_PER_STEP = 0.015;
const MINIMUM_PERIOD_SECONDS = 0.05;

const WAVE_DIRECTION_LEFT = 1;
const RAINBOW_LOOK = 0;

const NOISE_MAXIMUM_DRIFT_PER_SECOND = 1.6;
const NOISE_SMALLEST_FEATURE_KEYS = 1.5;
const NOISE_LARGEST_FEATURE_KEYS = 12;
const NOISE_CONTRAST_LOW = 0.3;
const NOISE_CONTRAST_HIGH = 0.7;
const NOISE_HASH_X = 0x27d4eb2d;
const NOISE_HASH_Y = 0x165667b1;
const NOISE_HASH_Z = 0x9e3779b1;
const NOISE_MIX_FIRST = 0x85ebca6b;
const NOISE_MIX_SECOND = 0xc2b2ae35;
const UNSIGNED_32_BIT_MAXIMUM = 0xffffffff;

const SPIRAL_ARMS = 2;
const SPIRAL_TWIST_PER_KEY = 0.55;
const SPIRAL_MAXIMUM_TURNS_PER_SECOND = 0.6;
const SPIRAL_MAXIMUM_WAVES_PER_SECOND = 1.2;

const SCAN_VERTICAL_DIRECTION = 3;
const SCAN_EDGE_SOFTNESS_KEYS = 1;

const RIPPLE_RING_WIDTH_KEYS = 1.25;

const TRAIL_RANDOM_COLOR_MODE = 1;
const TRAIL_SINGLE_COLOR_MODE = 2;
const TRAIL_INVERTED_FADE = 4;

const JELLY_RADIUS_KEYS = 2.5;
const JELLY_CORE_KEYS = 0.6;
const JELLY_RELEASE_SECONDS = 0.35;
const JELLY_WOBBLE_AMOUNT = 0.18;
const JELLY_WOBBLE_RADIANS_PER_SECOND = 14;

const AOE_RADIUS_KEYS = 3;
const AOE_EDGE_SOFTNESS_KEYS = 0.75;

const LOOK_PALETTES: readonly (readonly RgbColor[])[] = [
  ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff"],
  ["#00ffd5", "#0090ff", "#0018ff", "#00c8ff"],
  ["#ff0000", "#ff5a00", "#ffc800", "#ff3000"],
  ["#00ff3c", "#b4ff00", "#ff78c8", "#5affa0"],
  ["#ff0080", "#ff3cff", "#ff8cc8", "#c800ff"],
  ["#0000ff", "#7800ff", "#00a0ff", "#0050ff"],
].map((stops) => stops.map(colorFromHex));

interface FrameContext {
  readonly request: LightingFrameRequest;
  readonly keysById: ReadonlyMap<string, AnimatedKey>;
}

type BaseRenderer = (values: EffectValues, key: AnimatedKey, frame: FrameContext) => RgbColor;
type LayerRenderer = (color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext) => RgbColor;

const renderStatic: BaseRenderer = (_values, key, frame) => frame.request.keyColors.get(key.id) ?? BLACK;

const BASE_RENDERERS: ReadonlyMap<string, BaseRenderer> = new Map([
  [WootingEffectId.static, renderStatic],
  [WootingEffectId.wave, renderWave],
  [WootingEffectId.cycle, renderCycle],
  [WootingEffectId.noise, renderNoise],
  [WootingEffectId.spiral, renderSpiral],
]);

const LAYER_RENDERERS: ReadonlyMap<string, LayerRenderer> = new Map([
  [WootingEffectId.scan, renderScan],
  [WootingEffectId.breath, renderBreath],
  [WootingEffectId.ripple, renderRipple],
  [WootingEffectId.trail, renderTrail],
  [WootingEffectId.touch, renderTouch],
  [WootingEffectId.jelly, renderJelly],
  [WootingEffectId.aoe, renderAreaOfEffect],
  [WootingEffectId.mixing, renderMixing],
  [WootingEffectId.rtDisplay, renderRapidTriggerDisplay],
]);

const KEY_PRESS_EFFECT_IDS: ReadonlySet<string> = new Set([
  WootingEffectId.ripple,
  WootingEffectId.trail,
  WootingEffectId.touch,
  WootingEffectId.jelly,
  WootingEffectId.aoe,
  WootingEffectId.mixing,
  WootingEffectId.rtDisplay,
]);

export const WOOTING_EFFECT_ANIMATOR: LayeredEffectAnimator = {
  isAnimated: (effects) => effects.base.effectId !== WootingEffectId.static
    || effects.effectLayers.some((layer) => LAYER_RENDERERS.has(layer.effectId)),
  respondsToKeyPresses: (effects) => effects.effectLayers.some((layer) => KEY_PRESS_EFFECT_IDS.has(layer.effectId)),
  frame: (request) => {
    const frame: FrameContext = { request, keysById: new Map(request.board.keys.map((key) => [key.id, key])) };
    return new Map(request.board.keys.map((key) => [key.id, roundedColor(keyColorOf(request.effects, key, frame))]));
  },
};

function keyColorOf(effects: LayeredEffects, key: AnimatedKey, frame: FrameContext): RgbColor {
  const renderBase = BASE_RENDERERS.get(effects.base.effectId) ?? renderStatic;
  return effects.effectLayers.reduce(
    (color, layer) => applyLayer(color, layer, key, frame),
    renderBase(effects.base.values, key, frame),
  );
}

function applyLayer(color: RgbColor, layer: EffectLayer, key: AnimatedKey, frame: FrameContext): RgbColor {
  const renderLayer = LAYER_RENDERERS.get(layer.effectId);
  return renderLayer ? renderLayer(color, layer.values, key, frame) : color;
}

function renderWave(values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const { board, timeSeconds } = frame.request;
  const travelSign = numberOf(values, "direction") === WAVE_DIRECTION_LEFT ? 1 : -1;
  const phase = key.centerX / Math.max(board.width, 1) + (travelSign * timeSeconds) / speedPeriodOf(values);
  return paletteColor(numberOf(values, "look"), phase);
}

function renderCycle(values: EffectValues, _key: AnimatedKey, frame: FrameContext): RgbColor {
  return paletteColor(numberOf(values, "look"), frame.request.timeSeconds / speedPeriodOf(values));
}

function renderNoise(values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const drift = frame.request.timeSeconds * (numberOf(values, "speed") / RAW_BRIGHTNESS_MAXIMUM)
    * NOISE_MAXIMUM_DRIFT_PER_SECOND;
  const featureKeys = interpolate(
    NOISE_SMALLEST_FEATURE_KEYS,
    NOISE_LARGEST_FEATURE_KEYS,
    numberOf(values, "scale") / RAW_PERCENT_MAXIMUM,
  );
  const noise = valueNoise(key.centerX / featureKeys, key.centerY / featureKeys, drift);
  return mixed(
    colorOf(values, "primaryColor"),
    colorOf(values, "secondaryColor"),
    smoothStep(NOISE_CONTRAST_LOW, NOISE_CONTRAST_HIGH, noise),
  );
}

function renderSpiral(values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const { board, timeSeconds } = frame.request;
  const offsetX = key.centerX - board.width / 2;
  const offsetY = key.centerY - board.height / 2;
  const spinTurns = timeSeconds * (numberOf(values, "spinSpeed") / SPIRAL_SPEED_MAXIMUM)
    * SPIRAL_MAXIMUM_TURNS_PER_SECOND * (flagOf(values, "spinClockwise") ? 1 : -1);
  const spiralWaves = timeSeconds * (numberOf(values, "spiralSpeed") / SPIRAL_SPEED_MAXIMUM)
    * SPIRAL_MAXIMUM_WAVES_PER_SECOND * (flagOf(values, "spiralClockwise") ? 1 : -1);
  const phase = SPIRAL_ARMS * (Math.atan2(offsetY, offsetX) - spinTurns * FULL_TURN_RADIANS)
    + Math.hypot(offsetX, offsetY) * SPIRAL_TWIST_PER_KEY
    - spiralWaves * FULL_TURN_RADIANS;
  return mixed(colorOf(values, "primaryColor"), colorOf(values, "secondaryColor"), (1 + Math.sin(phase)) / 2);
}

function renderScan(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const { board, timeSeconds } = frame.request;
  const isVertical = numberOf(values, "direction") === SCAN_VERTICAL_DIRECTION;
  const position = isVertical ? key.centerY : key.centerX;
  const span = isVertical ? board.height : board.width;
  const halfWidth = numberOf(values, "width") / 2;
  const margin = halfWidth + SCAN_EDGE_SOFTNESS_KEYS;
  const travel = span + margin * 2;
  const barCenter = fraction((timeSeconds * numberOf(values, "speed")) / travel) * travel - margin;
  const intensity = clamped((margin - Math.abs(position - barCenter)) / SCAN_EDGE_SOFTNESS_KEYS);
  return scaled(color, litFraction(values, intensity));
}

function renderBreath(color: RgbColor, values: EffectValues, _key: AnimatedKey, frame: FrameContext): RgbColor {
  const floor = numberOf(values, "secondaryBrightness") / RAW_BRIGHTNESS_MAXIMUM;
  const swing = (1 + Math.cos((FULL_TURN_RADIANS * frame.request.timeSeconds) / speedPeriodOf(values))) / 2;
  return scaled(color, floor + (1 - floor) * swing);
}

function renderRipple(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const { presses, timeSeconds } = frame.request;
  const fadeSeconds = Math.max(numberOf(values, "fadeSpeed") * RIPPLE_FADE_SECONDS_PER_STEP, MINIMUM_PERIOD_SECONDS);
  const spreadPerSecond = numberOf(values, "spreadSpeed");
  let strongest = 0;
  let strongestPress: KeyPress | undefined;
  for (const press of presses) {
    const origin = frame.keysById.get(press.keyId);
    const age = timeSeconds - press.pressedAt;
    if (!origin || age < 0 || age > fadeSeconds) continue;
    const ring = clamped(1 - Math.abs(distanceBetween(key, origin) - age * spreadPerSecond) / RIPPLE_RING_WIDTH_KEYS);
    const strength = ring * (1 - age / fadeSeconds);
    if (strength <= strongest) continue;
    strongest = strength;
    strongestPress = press;
  }
  if (flagOf(values, "inverted")) return scaled(color, 1 - strongest);
  if (flagOf(values, "randomColors") && strongestPress) {
    return mixed(scaled(color, baseBrightnessOf(values)), randomColorOf(strongestPress), strongest);
  }
  return scaled(color, litFraction(values, strongest));
}

function renderTrail(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const fadeSeconds = speedPeriodOf(values);
  let intensity = 0;
  let brightestPress: KeyPress | undefined;
  for (const press of pressesOf(frame, key)) {
    const pressIntensity = press.releasedAt === undefined
      ? 1
      : clamped(1 - (frame.request.timeSeconds - press.releasedAt) / fadeSeconds);
    if (pressIntensity <= intensity) continue;
    intensity = pressIntensity;
    brightestPress = press;
  }
  const colorMode = numberOf(values, "colorMode");
  const trailColor = colorMode === TRAIL_SINGLE_COLOR_MODE
    ? colorOf(values, "customColor")
    : colorMode === TRAIL_RANDOM_COLOR_MODE && brightestPress ? randomColorOf(brightestPress) : color;
  const shown = numberOf(values, "fadeDirection") === TRAIL_INVERTED_FADE ? 1 - intensity : intensity;
  return mixed(scaled(color, baseBrightnessOf(values)), trailColor, shown);
}

function renderTouch(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const press = activePressOf(frame, key);
  return scaled(color, litFraction(values, press ? depthResponseOf(values, press) : 0));
}

function renderJelly(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const { presses, timeSeconds } = frame.request;
  let strongest = 0;
  for (const press of presses) {
    const origin = frame.keysById.get(press.keyId);
    if (!origin) continue;
    const fade = press.releasedAt === undefined
      ? 1
      : clamped(1 - (timeSeconds - press.releasedAt) / JELLY_RELEASE_SECONDS);
    if (fade === 0) continue;
    const wobble = 1 + JELLY_WOBBLE_AMOUNT * Math.sin((timeSeconds - press.pressedAt) * JELLY_WOBBLE_RADIANS_PER_SECOND);
    const radius = JELLY_RADIUS_KEYS * depthResponseOf(values, press) * fade * wobble + JELLY_CORE_KEYS;
    const falloff = clamped(1 - (distanceBetween(key, origin) / radius) ** 2);
    strongest = Math.max(strongest, falloff * fade);
  }
  return scaled(color, litFraction(values, strongest));
}

function renderAreaOfEffect(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  let strongest = 0;
  for (const press of frame.request.presses) {
    const origin = frame.keysById.get(press.keyId);
    if (!origin || press.releasedAt !== undefined) continue;
    const radius = AOE_RADIUS_KEYS * depthResponseOf(values, press);
    const edge = clamped((radius + AOE_EDGE_SOFTNESS_KEYS - distanceBetween(key, origin)) / AOE_EDGE_SOFTNESS_KEYS);
    strongest = Math.max(strongest, edge);
  }
  return scaled(color, litFraction(values, strongest));
}

function renderMixing(color: RgbColor, values: EffectValues, key: AnimatedKey, frame: FrameContext): RgbColor {
  const press = activePressOf(frame, key);
  if (!press) return color;
  return mixed(color, invertedColor(color), depthResponseOf(values, press));
}

function renderRapidTriggerDisplay(
  color: RgbColor,
  values: EffectValues,
  key: AnimatedKey,
  frame: FrameContext,
): RgbColor {
  return scaled(color, litFraction(values, activePressOf(frame, key) ? 1 : 0));
}

function pressesOf(frame: FrameContext, key: AnimatedKey): KeyPress[] {
  return frame.request.presses.filter((press) => press.keyId === key.id);
}

function activePressOf(frame: FrameContext, key: AnimatedKey): KeyPress | undefined {
  return frame.request.presses.find((press) => press.keyId === key.id && press.releasedAt === undefined);
}

function depthResponseOf(values: EffectValues, press: KeyPress): number {
  return flagOf(values, "useAnalogCurve") ? clamped(press.depth) : 1;
}

function litFraction(values: EffectValues, intensity: number): number {
  const baseBrightness = baseBrightnessOf(values);
  return baseBrightness + (1 - baseBrightness) * intensity;
}

function baseBrightnessOf(values: EffectValues): number {
  return numberOf(values, "baseBrightness") / RAW_BRIGHTNESS_MAXIMUM;
}

function speedPeriodOf(values: EffectValues): number {
  return Math.max(numberOf(values, "speed") * SECONDS_PER_SPEED_STEP, MINIMUM_PERIOD_SECONDS);
}

function randomColorOf(press: KeyPress): RgbColor {
  return paletteColor(RAINBOW_LOOK, press.sequence * GOLDEN_RATIO_CONJUGATE);
}

function paletteColor(look: number, phase: number): RgbColor {
  const stops = LOOK_PALETTES[look] ?? LOOK_PALETTES[RAINBOW_LOOK];
  const position = fraction(phase) * stops.length;
  const index = Math.floor(position) % stops.length;
  return mixed(stops[index], stops[(index + 1) % stops.length], position - Math.floor(position));
}

function valueNoise(x: number, y: number, z: number): number {
  const [cellX, cellY, cellZ] = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const [blendX, blendY, blendZ] = [x - cellX, y - cellY, z - cellZ].map((offset) => smoothStep(0, 1, offset));
  const corner = (stepX: number, stepY: number, stepZ: number) => latticeValue(
    cellX + stepX,
    cellY + stepY,
    cellZ + stepZ,
  );
  const plane = (stepZ: number) => interpolate(
    interpolate(corner(0, 0, stepZ), corner(1, 0, stepZ), blendX),
    interpolate(corner(0, 1, stepZ), corner(1, 1, stepZ), blendX),
    blendY,
  );
  return interpolate(plane(0), plane(1), blendZ);
}

function latticeValue(x: number, y: number, z: number): number {
  let hash = Math.imul(x, NOISE_HASH_X) ^ Math.imul(y, NOISE_HASH_Y) ^ Math.imul(z, NOISE_HASH_Z);
  hash = Math.imul(hash ^ (hash >>> 15), NOISE_MIX_FIRST);
  hash = Math.imul(hash ^ (hash >>> 13), NOISE_MIX_SECOND);
  hash ^= hash >>> 16;
  return (hash >>> 0) / UNSIGNED_32_BIT_MAXIMUM;
}

function numberOf(values: EffectValues, parameterId: string): number {
  const value = values[parameterId];
  return typeof value === "number" ? value : 0;
}

function flagOf(values: EffectValues, parameterId: string): boolean {
  return values[parameterId] === true;
}

function colorOf(values: EffectValues, parameterId: string): RgbColor {
  const value = values[parameterId];
  return typeof value === "object" ? value : WHITE;
}

function distanceBetween(first: AnimatedKey, second: AnimatedKey): number {
  return Math.hypot(first.centerX - second.centerX, first.centerY - second.centerY);
}

function scaled(color: RgbColor, factor: number): RgbColor {
  return { red: color.red * factor, green: color.green * factor, blue: color.blue * factor };
}

function mixed(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  return {
    red: interpolate(from.red, to.red, amount),
    green: interpolate(from.green, to.green, amount),
    blue: interpolate(from.blue, to.blue, amount),
  };
}

function invertedColor(color: RgbColor): RgbColor {
  return {
    red: MAXIMUM_CHANNEL_VALUE - color.red,
    green: MAXIMUM_CHANNEL_VALUE - color.green,
    blue: MAXIMUM_CHANNEL_VALUE - color.blue,
  };
}

function roundedColor(color: RgbColor): RgbColor {
  return { red: roundedChannel(color.red), green: roundedChannel(color.green), blue: roundedChannel(color.blue) };
}

function roundedChannel(channel: number): number {
  return Math.min(MAXIMUM_CHANNEL_VALUE, Math.max(0, Math.round(channel)));
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothStep(low: number, high: number, value: number): number {
  const position = clamped((value - low) / (high - low));
  return position * position * (3 - 2 * position);
}

function clamped(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function fraction(value: number): number {
  return value - Math.floor(value);
}
