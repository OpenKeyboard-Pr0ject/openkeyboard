import type {
  ChoiceOption,
  EffectDescriptor,
  EffectParameter,
  LayeredEffectCatalog,
  ParameterDisplay,
} from "../../keyboard/lighting-effects";
import {
  wootingEffectDefaults,
  WootingEffectId,
  type WootingEffectIdValue,
} from "../../protocol/wooting/wooting-rgb-effects-codec";
import { WOOTING_EFFECT_ANIMATOR } from "./wooting-effect-animation";
import { WOOTING_RGB_PRESETS } from "./wooting-rgb-presets";

const MAXIMUM_EFFECT_LAYERS = 3;
const BRIGHTNESS_RAW_MAXIMUM = 255;
const SPIRAL_SPEED_MAXIMUM = 127;
const PERCENT = 100;
const QUARTER_SECOND = 0.25;
const RIPPLE_FADE_SECONDS_PER_STEP = 0.015;

const SECONDS: ParameterDisplay = { scale: QUARTER_SECOND, decimals: 2, unit: "s" };
const RIPPLE_FADE_SECONDS: ParameterDisplay = { scale: RIPPLE_FADE_SECONDS_PER_STEP, decimals: 2, unit: "s" };
const PERCENT_OF_BRIGHTNESS: ParameterDisplay = { scale: PERCENT / BRIGHTNESS_RAW_MAXIMUM, decimals: 0, unit: "%" };
const PERCENT_OF_SPIRAL_SPEED: ParameterDisplay = { scale: PERCENT / SPIRAL_SPEED_MAXIMUM, decimals: 0, unit: "%" };
const PLAIN_PERCENT: ParameterDisplay = { scale: 1, decimals: 0, unit: "%" };
const KEYS: ParameterDisplay = { scale: 1, decimals: 0, unit: "keys" };
const KEYS_PER_SECOND: ParameterDisplay = { scale: 1, decimals: 0, unit: "keys/s" };

const COLOR_LOOKS: readonly ChoiceOption[] = [
  { value: 0, label: "Rainbow" },
  { value: 1, label: "Ocean" },
  { value: 2, label: "Inferno" },
  { value: 3, label: "Spring" },
  { value: 4, label: "Pink!" },
  { value: 5, label: "Blue Spectrum" },
];

const ANALOG_CURVE_HINT = "Lights the key more the further it is pressed, instead of fully at the actuation point.";

const baseBrightness: EffectParameter = {
  kind: "slider",
  id: "baseBrightness",
  label: "Base Brightness",
  min: 0,
  max: BRIGHTNESS_RAW_MAXIMUM,
  display: PERCENT_OF_BRIGHTNESS,
};

const useAnalogCurve: EffectParameter = {
  kind: "toggle",
  id: "useAnalogCurve",
  label: "Use Analog Curve",
  hint: ANALOG_CURVE_HINT,
};

const primaryColor: EffectParameter = { kind: "color", id: "primaryColor", label: "Primary Color" };
const secondaryColor: EffectParameter = { kind: "color", id: "secondaryColor", label: "Secondary Color" };

function secondsSlider(id: string, label: string, min: number, max: number): EffectParameter {
  return { kind: "slider", id, label, min, max, display: SECONDS };
}

function effect(id: WootingEffectIdValue, label: string, parameters: readonly EffectParameter[]): EffectDescriptor {
  return { id, label, parameters, defaults: wootingEffectDefaults(id) };
}

const BASE_EFFECTS: readonly EffectDescriptor[] = [
  effect(WootingEffectId.static, "Static", []),
  effect(WootingEffectId.wave, "Wave", [
    { kind: "choice", id: "look", label: "Wave Look", options: COLOR_LOOKS, presentation: "menu" },
    secondsSlider("speed", "Speed", 4, 60),
    {
      kind: "choice",
      id: "direction",
      label: "Direction",
      options: [{ value: 1, label: "Left" }, { value: 0, label: "Right" }],
      presentation: "buttons",
    },
  ]),
  effect(WootingEffectId.cycle, "Cycle", [
    { kind: "choice", id: "look", label: "Cycle Look", options: COLOR_LOOKS, presentation: "menu" },
    secondsSlider("speed", "Speed", 4, 80),
  ]),
  effect(WootingEffectId.noise, "Noise", [
    {
      kind: "slider",
      id: "speed",
      label: "Speed",
      min: 0,
      max: BRIGHTNESS_RAW_MAXIMUM,
      display: PERCENT_OF_BRIGHTNESS,
    },
    { kind: "slider", id: "scale", label: "Scale", min: 0, max: PERCENT, display: PLAIN_PERCENT },
    primaryColor,
    secondaryColor,
  ]),
  effect(WootingEffectId.spiral, "Spiral", [
    {
      kind: "slider",
      id: "spinSpeed",
      label: "Spin Speed",
      min: 0,
      max: SPIRAL_SPEED_MAXIMUM,
      display: PERCENT_OF_SPIRAL_SPEED,
    },
    {
      kind: "slider",
      id: "spiralSpeed",
      label: "Spiral Speed",
      min: 0,
      max: SPIRAL_SPEED_MAXIMUM,
      display: PERCENT_OF_SPIRAL_SPEED,
    },
    { kind: "toggle", id: "spinClockwise", label: "Spin Clockwise" },
    { kind: "toggle", id: "spiralClockwise", label: "Spiral Clockwise" },
    primaryColor,
    secondaryColor,
  ]),
];

const LAYER_EFFECTS: readonly EffectDescriptor[] = [
  effect(WootingEffectId.jelly, "Jelly", [baseBrightness, useAnalogCurve]),
  effect(WootingEffectId.scan, "Scan", [
    { kind: "slider", id: "width", label: "Width", min: 1, max: 7, display: KEYS },
    { kind: "slider", id: "speed", label: "Speed", min: 1, max: 50, display: KEYS_PER_SECOND },
    baseBrightness,
    {
      kind: "choice",
      id: "direction",
      label: "Direction",
      options: [{ value: 0, label: "Horizontal" }, { value: 3, label: "Vertical" }],
      presentation: "buttons",
    },
  ]),
  effect(WootingEffectId.breath, "Breath", [
    secondsSlider("speed", "Speed", 1, 40),
    {
      kind: "slider",
      id: "secondaryBrightness",
      label: "Secondary Brightness",
      min: 0,
      max: BRIGHTNESS_RAW_MAXIMUM,
      display: PERCENT_OF_BRIGHTNESS,
    },
  ]),
  effect(WootingEffectId.ripple, "Ripple", [
    { kind: "slider", id: "spreadSpeed", label: "Spread Speed", min: 1, max: 50, display: KEYS_PER_SECOND },
    { kind: "slider", id: "fadeSpeed", label: "Fade Speed", min: 1, max: 253, display: RIPPLE_FADE_SECONDS },
    baseBrightness,
    { kind: "toggle", id: "randomColors", label: "Random Colors" },
    { kind: "toggle", id: "inverted", label: "Inverted" },
  ]),
  effect(WootingEffectId.touch, "Touch", [baseBrightness, useAnalogCurve]),
  effect(WootingEffectId.aoe, "AOE", [baseBrightness, useAnalogCurve]),
  effect(WootingEffectId.mixing, "Mixing", [useAnalogCurve]),
  effect(WootingEffectId.trail, "Trail", [
    secondsSlider("speed", "Speed", 1, 40),
    baseBrightness,
    {
      kind: "choice",
      id: "colorMode",
      label: "Color Mode",
      options: [
        { value: 0, label: "Base Layer" },
        { value: 1, label: "Random Colors" },
        { value: 2, label: "Single Color" },
      ],
      presentation: "buttons",
    },
    { kind: "color", id: "customColor", label: "Custom Color", visibleWhen: { parameterId: "colorMode", equals: 2 } },
    {
      kind: "choice",
      id: "fadeDirection",
      label: "Fade Direction",
      options: [{ value: 0, label: "Normal" }, { value: 4, label: "Inverted" }],
      presentation: "buttons",
    },
  ]),
  effect(WootingEffectId.rtDisplay, "RT display", [baseBrightness]),
];

export const WOOTING_EFFECT_CATALOG: LayeredEffectCatalog = {
  keyColorLayers: [
    { name: "Main Layer", editable: true },
    {
      name: "Fn Layer 1",
      editable: false,
      explanation: "The keyboard stores Fn layer colors outside the RGB settings OpenKeyboard has decoded.",
    },
  ],
  baseEffects: BASE_EFFECTS,
  layerEffects: LAYER_EFFECTS,
  maximumEffectLayers: MAXIMUM_EFFECT_LAYERS,
  newEffectLayerId: WootingEffectId.scan,
  keyColorsBaseEffectId: WootingEffectId.static,
  presets: WOOTING_RGB_PRESETS,
  animator: WOOTING_EFFECT_ANIMATOR,
};
