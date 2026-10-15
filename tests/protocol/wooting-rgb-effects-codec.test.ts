import { describe, expect, it } from "vitest";
import {
  decodeRgbEffects,
  UnknownWootingEffectError,
  withRgbEffects,
  wootingEffectDefaults,
  WootingEffectId,
} from "../../src/protocol/wooting/wooting-rgb-effects-codec";
import { payloadOf, typingRgbCorePayload } from "../fakes/wooting-80he-captures";

const CORE_SETTINGS = "0a0b08ff0110ffff0318ffff03";

function coreWithEffects(effectsHex: string): Uint8Array {
  return payloadOf(CORE_SETTINGS + effectsHex);
}

const WOOTILITY_PREVIEWS: ReadonlyArray<readonly [string, string]> = [
  ["Static", "2200"],
  ["Wave, Rainbow, 4.00 s, Left", "220a0a080a06080010101801"],
  ["Wave, Ocean, 4.00 s, Left", "220a0a080a06080110101801"],
  ["Wave, Blue Spectrum, 10.00 s, Left", "220a0a080a06080510281801"],
  ["Cycle", "22080a06220408001030"],
  ["Noise", "220e0a0c720a089f3010e10f18322019"],
  ["Spiral", "22100a0e7a0c089ff00310ff0f1864208b01"],
  ["Spiral, spin clockwise", "22100a0e7a0c089ff00310ff0f1863208b01"],
  ["Spiral, spiral counter-clockwise", "22100a0e7a0c089ff00310ff0f1864208c01"],
  ["Spiral, spin 115 clockwise", "22110a0f7a0d089ff00310ff0f18e501208c01"],
  ["Cycle and Mixing", "220e0a062204080010300a0452020800"],
  ["Cycle and RT display", "220f0a062204080010300a055a03088c01"],
  ["Cycle and Breath", "22100a062204080010300a061a04080f1800"],
  ["Cycle and Breath, secondary brightness 34 %", "22100a062204080010300a061a04080f1857"],
  ["Cycle and Jelly", "22100a062204080010300a064204081e1000"],
  ["Cycle and AOE", "22100a062204080010300a064a04081e1000"],
  ["Cycle and Scan", "22140a062204080010300a0a12080801100f181e2000"],
  ["Cycle and Scan, vertical", "22140a062204080010300a0a12080801100f181e2003"],
  ["Cycle and Ripple", "22140a062204080010300a0a2a0808001014181e201e"],
  ["Cycle and Ripple, random colours", "22140a062204080010300a0a2a0808011014181e201e"],
  ["Cycle and Ripple, random colours, inverted", "22140a062204080010300a0a2a0808051014181e201e"],
  ["Cycle and Ripple, base brightness 13 %", "22140a062204080010300a0a2a0808051014181e2020"],
  ["Cycle and Ripple, fade 2.07 s", "22150a062204080010300a0b2a0908051014188a012020"],
  ["Cycle and Trail", "22160a062204080010300a0c320a081e1004180020ffff03"],
  ["Cycle and Trail, random colours", "22160a062204080010300a0c320a081e1004180120ffff03"],
  ["Cycle and Trail, single colour", "22160a062204080010300a0c320a081e1004180220ffff03"],
  ["Cycle and Trail, inverted fade", "22160a062204080010300a0c320a081e1004180420ffff03"],
  ["Cycle and Touch", "22160a062204080010300a0c3a0a081e1000180020002801"],
  ["Cycle and Touch, analog curve", "22160a062204080010300a0c3a0a081e1001180020002801"],
  ["Static and RT display", "22070a055a03088c01"],
  ["Static, RT display and two Scan layers", "221f0a055a03088c010a0a12080801100f181e20000a0a12080801100f181e2000"],
];

describe("Wooting RGB effects codec", () => {
  it("decodes Typing Profile's Wave: Rainbow, 4.00 s, to the right", () => {
    expect(decodeRgbEffects(typingRgbCorePayload)).toEqual({
      base: { effectId: "wave", values: { look: 0, speed: 16, direction: 0 } },
      effectLayers: [],
    });
  });

  it.each(WOOTILITY_PREVIEWS)("writes the bytes Wootility previewed for %s", (_name, effectsHex) => {
    const captured = coreWithEffects(effectsHex);

    const written = withRgbEffects(typingRgbCorePayload, decodeRgbEffects(captured));

    expect([...written]).toEqual([...captured]);
  });

  it("reads a core without an effects field as Static without layers", () => {
    expect(decodeRgbEffects(payloadOf(CORE_SETTINGS))).toEqual({
      base: { effectId: "static", values: {} },
      effectLayers: [],
    });
  });

  it("decodes Spiral's signed speeds into speed and direction", () => {
    const { base } = decodeRgbEffects(coreWithEffects("22110a0f7a0d089ff00310ff0f18e501208c01"));

    expect(base.values).toMatchObject({
      spinSpeed: 115,
      spinClockwise: true,
      spiralSpeed: 70,
      spiralClockwise: false,
    });
  });

  it("decodes Trail's colour mode and fade direction from one field", () => {
    const trail = decodeRgbEffects(coreWithEffects("22160a062204080010300a0c320a081e1004180620ffff03"))
      .effectLayers[0];

    expect(trail.values).toMatchObject({ colorMode: 2, fadeDirection: 4 });
  });

  it("keeps fields it does not decode when a stored layer is edited", () => {
    const stored = coreWithEffects("22090a073a05180720ff01");
    const effects = decodeRgbEffects(stored);
    const edited = {
      ...effects,
      effectLayers: [{ ...effects.effectLayers[0], values: { ...effects.effectLayers[0].values, baseBrightness: 60 } }],
    };

    expect([...withRgbEffects(stored, edited)]).toEqual([...coreWithEffects("220d0a0b3a09083c1000180720ff01")]);
  });

  it("starts a new layer from the defaults Wootility uses", () => {
    const effects = {
      base: { effectId: WootingEffectId.static, values: {} },
      effectLayers: [{ effectId: WootingEffectId.touch, values: wootingEffectDefaults(WootingEffectId.touch) }],
    };

    expect([...withRgbEffects(typingRgbCorePayload, effects)])
      .toEqual([...coreWithEffects("220e0a0c3a0a081e1000180020002801")]);
  });

  it("passes an effect it does not know through unchanged", () => {
    const stored = coreWithEffects("22070a05a201020805");
    const effects = decodeRgbEffects(stored);

    expect(effects.effectLayers[0].effectId).toBe("unknown-effect-20");
    expect([...withRgbEffects(stored, effects)]).toEqual([...stored]);
  });

  it("refuses an effect it cannot encode", () => {
    const effects = { base: { effectId: "sparkle", values: {} }, effectLayers: [] };

    expect(() => withRgbEffects(typingRgbCorePayload, effects)).toThrow(UnknownWootingEffectError);
  });

  it("keeps the brightness and other core settings", () => {
    const effects = { base: { effectId: WootingEffectId.static, values: {} }, effectLayers: [] };

    expect([...withRgbEffects(typingRgbCorePayload, effects)]).toEqual([...coreWithEffects("2200")]);
  });

  it("reports Wootility's defaults for every effect", () => {
    expect(wootingEffectDefaults(WootingEffectId.noise)).toEqual({
      primaryColor: { red: 25, green: 0, blue: 255 },
      secondaryColor: { red: 0, green: 255, blue: 8 },
      speed: 50,
      scale: 25,
    });
    expect(wootingEffectDefaults(WootingEffectId.spiral)).toMatchObject({
      spinSpeed: 50,
      spinClockwise: false,
      spiralSpeed: 70,
      spiralClockwise: true,
    });
    expect(wootingEffectDefaults(WootingEffectId.ripple)).toEqual({
      randomColors: false,
      inverted: false,
      spreadSpeed: 20,
      fadeSpeed: 30,
      baseBrightness: 30,
    });
  });
});
