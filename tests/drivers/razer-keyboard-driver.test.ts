import { describe, expect, it } from "vitest";
import { driverFor } from "../../src/drivers/keyboard-driver-registry";
import { razerKeyboardDriver } from "../../src/drivers/razer/razer-keyboard-driver";
import { RazerKeyboardNotRespondingError } from "../../src/protocol/razer/razer-codec";
import { FakeRazerKeyboard, razerConsumerKeysCollection } from "../fakes/fake-razer-keyboard";
import { BLACKWIDOW_V3_MINI_RECEIVER_PRODUCT_ID } from "../fakes/razer-blackwidow-v3-mini-captures";

const noAuthorizedDevices = async (): Promise<HIDDevice[]> => [];

describe("razerKeyboardDriver.supports", () => {
  it("accepts the control interface of the wired BlackWidow V3 Mini", () => {
    expect(razerKeyboardDriver.supports(new FakeRazerKeyboard().asHidDevice())).toBe(true);
  });

  it("accepts the control interface of the HyperSpeed receiver", () => {
    const receiver = new FakeRazerKeyboard({ productId: BLACKWIDOW_V3_MINI_RECEIVER_PRODUCT_ID });

    expect(razerKeyboardDriver.supports(receiver.asHidDevice())).toBe(true);
  });

  it("rejects the media key interface that has no control report", () => {
    const mediaKeys = new FakeRazerKeyboard({ collections: [razerConsumerKeysCollection] });

    expect(razerKeyboardDriver.supports(mediaKeys.asHidDevice())).toBe(false);
  });

  it("rejects Razer products that were never examined", () => {
    const otherProduct = new FakeRazerKeyboard({ productId: 0x0203 });

    expect(razerKeyboardDriver.supports(otherProduct.asHidDevice())).toBe(false);
  });

  it("is chosen by the registry for the BlackWidow V3 Mini", () => {
    expect(driverFor(new FakeRazerKeyboard().asHidDevice())).toBe(razerKeyboardDriver);
  });
});

describe("razerKeyboardDriver.explainUnusableInterface", () => {
  it("explains a known Razer interface without the control report", () => {
    const mediaKeys = new FakeRazerKeyboard({ collections: [razerConsumerKeysCollection] });

    expect(razerKeyboardDriver.explainUnusableInterface?.(mediaKeys.asHidDevice())).toMatch(/control interface/);
  });

  it("stays silent for the control interface itself", () => {
    expect(razerKeyboardDriver.explainUnusableInterface?.(new FakeRazerKeyboard().asHidDevice())).toBeUndefined();
  });

  it("stays silent for Razer products that were never examined", () => {
    const otherProduct = new FakeRazerKeyboard({ productId: 0x0203, collections: [razerConsumerKeysCollection] });

    expect(razerKeyboardDriver.explainUnusableInterface?.(otherProduct.asHidDevice())).toBeUndefined();
  });
});

describe("Razer keyboard session", () => {
  it("opens the device when it is not open yet", async () => {
    const keyboard = new FakeRazerKeyboard();

    await razerKeyboardDriver.open(keyboard.asHidDevice(), noAuthorizedDevices);

    expect(keyboard.opened).toBe(true);
  });

  it("reads the identity of the wired BlackWidow V3 Mini", async () => {
    const session = await razerKeyboardDriver.open(new FakeRazerKeyboard().asHidDevice(), noAuthorizedDevices);

    await expect(session.readIdentity()).resolves.toEqual({
      vendorName: "Razer",
      productName: "Razer BlackWidow V3 Mini",
      vendorId: 0x1532,
      productId: 0x0258,
      firmwareVersion: "2.3",
      hardwareVerified: true,
    });
  });

  it("offers lighting and device settings with editors on the wired keyboard", async () => {
    const session = await razerKeyboardDriver.open(new FakeRazerKeyboard().asHidDevice(), noAuthorizedDevices);

    expect(session.lighting).toBeDefined();
    expect(session.lightingEditor).toBeDefined();
    expect(session.deviceSettings).toBeDefined();
    expect(session.deviceSettingsEditor).toBeDefined();
  });

  it("keeps the receiver read-only and unverified", async () => {
    const receiver = new FakeRazerKeyboard({ productId: BLACKWIDOW_V3_MINI_RECEIVER_PRODUCT_ID });
    const session = await razerKeyboardDriver.open(receiver.asHidDevice(), noAuthorizedDevices);

    expect((await session.readIdentity()).hardwareVerified).toBe(false);
    expect(session.lightingEditor).toBeUndefined();
    expect(session.deviceSettingsEditor).toBeUndefined();
  });

  it("explains a receiver whose keyboard is off", async () => {
    const receiver = new FakeRazerKeyboard({
      productId: BLACKWIDOW_V3_MINI_RECEIVER_PRODUCT_ID,
      keyboardUnreachable: true,
    });
    const session = await razerKeyboardDriver.open(receiver.asHidDevice(), noAuthorizedDevices);

    await expect(session.readIdentity()).rejects.toBeInstanceOf(RazerKeyboardNotRespondingError);
  });

  it("closes the device", async () => {
    const keyboard = new FakeRazerKeyboard();
    const session = await razerKeyboardDriver.open(keyboard.asHidDevice(), noAuthorizedDevices);

    await session.close();

    expect(keyboard.opened).toBe(false);
  });
});
