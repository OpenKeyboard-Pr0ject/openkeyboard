import { afterEach, describe, expect, it, vi } from "vitest";
import { HidReplyTimeoutError } from "../../src/hid/input-report-waiter";
import { WootingProtocolError } from "../../src/protocol/wooting/wooting-codec";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import { firmwareVersionReply } from "../fakes/wooting-80he-captures";

describe("WootingCommandChannel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the command on feature report 1 padded to the declared length", async () => {
    const device = new FakeHidDevice({ respond: () => firmwareVersionReply });

    await new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);

    expect(device.sentFeatureReports).toEqual([{ reportId: 1, data: new Uint8Array([0xd1, 0xda, 0x01, 0, 0, 0, 0]) }]);
  });

  it("resolves with the payload of the matching reply", async () => {
    const device = new FakeHidDevice({ respond: () => firmwareVersionReply });

    const payload = await new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);

    expect([...payload]).toEqual([0x02, 0x0e, 0x00]);
  });

  it("ignores input reports that answer a different command", async () => {
    const device = new FakeHidDevice();
    const request = new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);
    await Promise.resolve();

    device.emitInputReport(1, new Uint8Array([0xd1, 0xda, 0x13, 0x88, 0, 0]));
    device.emitInputReport(1, firmwareVersionReply);

    await expect(request).resolves.toEqual(new Uint8Array([0x02, 0x0e, 0x00]));
  });

  it("accepts a reply that arrives on a larger input report", async () => {
    const device = new FakeHidDevice();
    const request = new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);
    await Promise.resolve();

    device.emitInputReport(2, firmwareVersionReply);

    await expect(request).resolves.toEqual(new Uint8Array([0x02, 0x0e, 0x00]));
  });

  it("rejects with a timeout when the keyboard never answers", async () => {
    vi.useFakeTimers();
    const device = new FakeHidDevice();
    const request = new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);
    const assertion = expect(request).rejects.toBeInstanceOf(HidReplyTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it("rejects with the send failure and stops listening for a reply", async () => {
    const device = new FakeHidDevice({ failFeatureReports: true });

    const request = new WootingCommandChannel(device.asHidDevice()).request(WootingCommand.getFirmwareVersion);

    await expect(request).rejects.toBeInstanceOf(WootingProtocolError);
    expect(device.listenerCount()).toBe(0);
  });

  it("sends the next command only after the previous one is answered", async () => {
    const device = new FakeHidDevice({ respond: () => firmwareVersionReply });
    const channel = new WootingCommandChannel(device.asHidDevice());

    const first = channel.request(WootingCommand.getFirmwareVersion);
    const second = channel.request(WootingCommand.getFirmwareVersion);
    await Promise.resolve();

    expect(device.sentFeatureReports).toHaveLength(1);
    await Promise.all([first, second]);
    expect(device.sentFeatureReports).toHaveLength(2);
  });
});
