import { describe, expect, it } from "vitest";
import { IdleTimeoutOutOfRangeError, RazerDeviceSettings } from "../../src/drivers/razer/razer-device-settings";
import { RazerWriteNotVerifiedError } from "../../src/drivers/razer/razer-write-verification";
import { UnsupportedPollingRateError } from "../../src/keyboard/device-settings";
import { RazerCommandChannel } from "../../src/protocol/razer/razer-command-channel";
import { FakeRazerKeyboard, type FakeRazerKeyboardOptions } from "../fakes/fake-razer-keyboard";

function settingsOf(options: FakeRazerKeyboardOptions = {}): {
  keyboard: FakeRazerKeyboard;
  settings: RazerDeviceSettings;
} {
  const keyboard = new FakeRazerKeyboard(options);
  return { keyboard, settings: new RazerDeviceSettings(new RazerCommandChannel(keyboard.asHidDevice())) };
}

describe("RazerDeviceSettings.readDeviceSettings", () => {
  it("reads the captured settings of the BlackWidow V3 Mini", async () => {
    const { settings } = settingsOf();

    await expect(settings.readDeviceSettings()).resolves.toEqual({
      pollingRateHz: 1000,
      idleTimeoutSeconds: 900,
      battery: { levelPercent: 100, charging: true },
    });
  });

  it("offers the polling rates from slowest to fastest", () => {
    expect(settingsOf().settings.supportedPollingRatesHz).toEqual([125, 500, 1000]);
  });
});

describe("RazerDeviceSettings.updateDeviceSettings", () => {
  it("writes the polling rate and confirms it", async () => {
    const { keyboard, settings } = settingsOf();

    const stored = await settings.updateDeviceSettings({ pollingRateHz: 500 });

    expect(stored.pollingRateHz).toBe(500);
    expect(keyboard.state.pollingRateCode).toBe(0x02);
    expect(keyboard.sentCommands()[0]).toBe("00:05");
  });

  it("writes the sleep timer and confirms it", async () => {
    const { keyboard, settings } = settingsOf();

    const stored = await settings.updateDeviceSettings({ idleTimeoutSeconds: 600 });

    expect(stored.idleTimeoutSeconds).toBe(600);
    expect(keyboard.sentCommands()).toEqual(["07:03", "00:85", "07:83", "07:80", "07:84"]);
  });

  it("refuses a polling rate the keyboard does not offer before sending anything", async () => {
    const { keyboard, settings } = settingsOf();

    await expect(settings.updateDeviceSettings({ pollingRateHz: 250 })).rejects.toBeInstanceOf(
      UnsupportedPollingRateError,
    );
    expect(keyboard.sentRequests).toEqual([]);
  });

  it.each([30, 61, 960])("refuses a sleep timer of %i seconds", async (idleTimeoutSeconds) => {
    const { settings } = settingsOf();

    await expect(settings.updateDeviceSettings({ idleTimeoutSeconds })).rejects.toBeInstanceOf(
      IdleTimeoutOutOfRangeError,
    );
  });

  it("reports settings the keyboard did not keep", async () => {
    const { settings } = settingsOf({ ignoresWrites: true });

    const update = settings.updateDeviceSettings({ pollingRateHz: 125, idleTimeoutSeconds: 300 });

    await expect(update).rejects.toThrow(new RazerWriteNotVerifiedError(["polling rate", "sleep timer"]));
  });
});
