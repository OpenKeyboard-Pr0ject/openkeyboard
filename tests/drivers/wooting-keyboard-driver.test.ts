import { describe, expect, it } from "vitest";
import { wootingKeyboardDriver } from "../../src/drivers/wooting/wooting-keyboard-driver";
import { WOOTING_VENDOR_ID } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice, wootingConfigCollection } from "../fakes/fake-hid-device";
import { firmwareVersionReply } from "../fakes/wooting-80he-captures";

const analogStreamCollection: HIDCollectionInfo = { ...wootingConfigCollection, usagePage: 0xff53, featureReports: [] };
const noAuthorizedDevices = async (): Promise<HIDDevice[]> => [];

describe("wootingKeyboardDriver.supports", () => {
  it("accepts a Wooting interface that exposes the config collection", () => {
    expect(wootingKeyboardDriver.supports(new FakeHidDevice().asHidDevice())).toBe(true);
  });

  it("rejects the analog stream interface of the same keyboard", () => {
    const analogInterface = new FakeHidDevice({ collections: [analogStreamCollection] });

    expect(wootingKeyboardDriver.supports(analogInterface.asHidDevice())).toBe(false);
  });

  it("rejects a config collection from another vendor", () => {
    const otherVendor = new FakeHidDevice({ vendorId: WOOTING_VENDOR_ID + 1 });

    expect(wootingKeyboardDriver.supports(otherVendor.asHidDevice())).toBe(false);
  });
});

describe("Wooting keyboard session", () => {
  it("opens the device when it is not open yet", async () => {
    const device = new FakeHidDevice({ respond: () => firmwareVersionReply });

    await wootingKeyboardDriver.open(device.asHidDevice(), noAuthorizedDevices);

    expect(device.opened).toBe(true);
  });

  it("reads the identity of the 80HE including its firmware version", async () => {
    const device = new FakeHidDevice({ respond: () => firmwareVersionReply });
    const session = await wootingKeyboardDriver.open(device.asHidDevice(), noAuthorizedDevices);

    await expect(session.readIdentity()).resolves.toEqual({
      vendorName: "Wooting",
      productName: "Wooting 80HE TenZ",
      vendorId: 0x31e3,
      productId: 0x1402,
      firmwareVersion: "2.14.0",
      hardwareVerified: true,
    });
  });

  it("marks product ids that were never tested on hardware as unverified", async () => {
    const device = new FakeHidDevice({ productId: 0x1322, respond: () => firmwareVersionReply });
    const session = await wootingKeyboardDriver.open(device.asHidDevice(), noAuthorizedDevices);

    const identity = await session.readIdentity();

    expect(identity.hardwareVerified).toBe(false);
  });
});
