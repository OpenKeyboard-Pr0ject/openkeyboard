import { describe, expect, it } from "vitest";
import {
  AnalogInterfaceNotAuthorizedError,
  WootingAnalogKeySource,
} from "../../src/drivers/wooting/wooting-analog-key-source";
import type { AnalogKeyReading } from "../../src/keyboard/analog-keys";
import { FakeHidDevice, wootingAnalogCollection } from "../fakes/fake-hid-device";
import { analogReportFourKeysHeld } from "../fakes/wooting-80he-captures";

function keyboardInterfaces() {
  const configInterface = new FakeHidDevice();
  const analogInterface = new FakeHidDevice({ collections: [wootingAnalogCollection] });
  const source = new WootingAnalogKeySource(
    configInterface.asHidDevice(),
    async () => [configInterface.asHidDevice(), analogInterface.asHidDevice()],
  );
  return { analogInterface, source };
}

describe("WootingAnalogKeySource", () => {
  it("opens the sibling analog interface of the same keyboard", async () => {
    const { analogInterface, source } = keyboardInterfaces();

    await source.start(() => undefined);

    expect(analogInterface.opened).toBe(true);
  });

  it("forwards each analog report as decoded key readings", async () => {
    const { analogInterface, source } = keyboardInterfaces();
    const received: (readonly AnalogKeyReading[])[] = [];
    await source.start((pressedKeys) => received.push(pressedKeys));

    analogInterface.emitInputReport(0, analogReportFourKeysHeld);

    expect(received[0]).toHaveLength(4);
  });

  it("stops listening and closes the analog interface when stopped", async () => {
    const { analogInterface, source } = keyboardInterfaces();
    const subscription = await source.start(() => undefined);

    await subscription.stop();

    expect({ opened: analogInterface.opened, listeners: analogInterface.listenerCount() })
      .toEqual({ opened: false, listeners: 0 });
  });

  it("explains that access is missing when the analog interface was never authorized", async () => {
    const configInterface = new FakeHidDevice();
    const source = new WootingAnalogKeySource(configInterface.asHidDevice(), async () => [configInterface.asHidDevice()]);

    await expect(source.start(() => undefined)).rejects.toBeInstanceOf(AnalogInterfaceNotAuthorizedError);
  });

  it("ignores the analog interface of a different keyboard model", async () => {
    const configInterface = new FakeHidDevice();
    const otherModel = new FakeHidDevice({ productId: 0x1322, collections: [wootingAnalogCollection] });
    const source = new WootingAnalogKeySource(configInterface.asHidDevice(), async () => [otherModel.asHidDevice()]);

    await expect(source.start(() => undefined)).rejects.toBeInstanceOf(AnalogInterfaceNotAuthorizedError);
  });
});
