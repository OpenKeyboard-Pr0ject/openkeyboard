import { describe, expect, it } from "vitest";
import { RazerLighting } from "../../src/drivers/razer/razer-lighting";
import { RazerWriteNotVerifiedError } from "../../src/drivers/razer/razer-write-verification";
import { BrightnessOutOfRangeError, UnsupportedLightingEffectError } from "../../src/keyboard/lighting";
import { RazerCommandChannel } from "../../src/protocol/razer/razer-command-channel";
import { FakeRazerKeyboard, type FakeRazerKeyboardOptions } from "../fakes/fake-razer-keyboard";

const red = { red: 0xff, green: 0, blue: 0 };
const blue = { red: 0, green: 0, blue: 0xff };

function lightingOf(options: FakeRazerKeyboardOptions = {}): { keyboard: FakeRazerKeyboard; lighting: RazerLighting } {
  const keyboard = new FakeRazerKeyboard(options);
  return { keyboard, lighting: new RazerLighting(new RazerCommandChannel(keyboard.asHidDevice())) };
}

describe("RazerLighting.readLighting", () => {
  it("reads the captured state of the BlackWidow V3 Mini", async () => {
    const { lighting } = lightingOf();

    await expect(lighting.readLighting()).resolves.toEqual({ brightnessPercent: 60, effect: { kind: "spectrum" } });
  });

  it("asks for the backlight brightness and effect", async () => {
    const { keyboard, lighting } = lightingOf();

    await lighting.readLighting();

    expect(keyboard.sentCommands()).toEqual(["0f:84", "0f:82"]);
    expect([...keyboard.sentRequests[0].subarray(8, 10)]).toEqual([0x01, 0x05]);
  });
});

describe("RazerLighting.updateLighting", () => {
  it("writes a new effect and returns what the keyboard stored", async () => {
    const { keyboard, lighting } = lightingOf();

    const stored = await lighting.updateLighting({ effect: { kind: "static", color: red } });

    expect(stored).toEqual({ brightnessPercent: 60, effect: { kind: "static", color: red } });
    expect(keyboard.state.effectArguments).toEqual([0x01, 0x05, 0x01, 0x00, 0x00, 0x01, 0xff, 0x00, 0x00]);
  });

  it("writes only the brightness when only the brightness changes", async () => {
    const { keyboard, lighting } = lightingOf();

    await lighting.updateLighting({ brightnessPercent: 40 });

    expect(keyboard.sentCommands()).toEqual(["0f:04", "0f:84", "0f:82"]);
    expect(keyboard.state.brightness).toBe(0x66);
  });

  it("writes the effect before the brightness", async () => {
    const { keyboard, lighting } = lightingOf();

    await lighting.updateLighting({ brightnessPercent: 100, effect: { kind: "wave", direction: "right-to-left" } });

    expect(keyboard.sentCommands().slice(0, 2)).toEqual(["0f:02", "0f:04"]);
  });

  it("reports a change the keyboard did not keep", async () => {
    const { lighting } = lightingOf({ ignoresWrites: true });

    const update = lighting.updateLighting({ brightnessPercent: 40, effect: { kind: "off" } });

    await expect(update).rejects.toThrow(new RazerWriteNotVerifiedError(["lighting effect", "brightness"]));
  });

  it.each([-1, 101, 50.5, Number.NaN])("refuses brightness %s before sending anything", async (brightnessPercent) => {
    const { keyboard, lighting } = lightingOf();

    await expect(lighting.updateLighting({ brightnessPercent })).rejects.toBeInstanceOf(BrightnessOutOfRangeError);
    expect(keyboard.sentRequests).toEqual([]);
  });

  it("refuses more colors than the keyboard stores", async () => {
    const { keyboard, lighting } = lightingOf();

    const update = lighting.updateLighting({ effect: { kind: "breathing", colors: [red, blue, red] } });

    await expect(update).rejects.toBeInstanceOf(UnsupportedLightingEffectError);
    expect(keyboard.sentRequests).toEqual([]);
  });

  it("refuses a color channel outside 0 to 255", async () => {
    const { lighting } = lightingOf();

    const update = lighting.updateLighting({ effect: { kind: "static", color: { red: 256, green: 0, blue: 0 } } });

    await expect(update).rejects.toThrow(/0 to 255/);
  });
});
