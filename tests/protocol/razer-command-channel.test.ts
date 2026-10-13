import { afterEach, describe, expect, it, vi } from "vitest";
import { RazerKeyboardNotRespondingError, RazerProtocolError } from "../../src/protocol/razer/razer-codec";
import { RazerCommandChannel, RazerReplyTimeoutError } from "../../src/protocol/razer/razer-command-channel";
import { RazerCommands } from "../../src/protocol/razer/razer-constants";
import { FakeRazerKeyboard } from "../fakes/fake-razer-keyboard";
import { firmwareVersionRequest } from "../fakes/razer-blackwidow-v3-mini-captures";

describe("RazerCommandChannel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the request as a 90-byte feature report without a report id", async () => {
    const keyboard = new FakeRazerKeyboard();

    await new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getFirmwareVersion);

    expect(keyboard.sentRequests).toEqual([firmwareVersionRequest]);
  });

  it("resolves with the reply arguments", async () => {
    const keyboard = new FakeRazerKeyboard();

    const reply = await new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getFirmwareVersion);

    expect([...reply]).toEqual([0x02, 0x03]);
  });

  it("keeps polling while the keyboard reports busy", async () => {
    const keyboard = new FakeRazerKeyboard({ busyPollsPerRequest: 3 });

    const reply = await new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getPollingRate);

    expect([...reply]).toEqual([0x01]);
  });

  it("accepts a reply that starts with the report id byte", async () => {
    const keyboard = new FakeRazerKeyboard({ repliesWithReportIdPrefix: true });

    const reply = await new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getFirmwareVersion);

    expect([...reply]).toEqual([0x02, 0x03]);
  });

  it("serializes requests so every reply belongs to its own request", async () => {
    const keyboard = new FakeRazerKeyboard();
    const channel = new RazerCommandChannel(keyboard.asHidDevice());

    const replies = await Promise.all([
      channel.request(RazerCommands.getFirmwareVersion),
      channel.request(RazerCommands.getPollingRate),
      channel.request(RazerCommands.getIdleTime),
    ]);

    expect(replies.map((reply) => [...reply])).toEqual([[0x02, 0x03], [0x01], [0x03, 0x84]]);
  });

  it("gives up when the keyboard stays busy", async () => {
    vi.useFakeTimers();
    const keyboard = new FakeRazerKeyboard({ busyPollsPerRequest: 1000 });
    const request = new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getFirmwareVersion);
    const assertion = expect(request).rejects.toBeInstanceOf(RazerReplyTimeoutError);

    await vi.advanceTimersByTimeAsync(1000);

    await assertion;
  });

  it("reports a failed send with the command", async () => {
    const keyboard = new FakeRazerKeyboard({ failFeatureReports: true });

    const request = new RazerCommandChannel(keyboard.asHidDevice()).request(RazerCommands.getFirmwareVersion);

    await expect(request).rejects.toThrow(new RazerProtocolError(
      "Could not send command 0x00:0x81: Failed to write the feature report.",
    ));
  });

  it("keeps working after a failed request", async () => {
    const keyboard = new FakeRazerKeyboard({ keyboardUnreachable: true });
    const channel = new RazerCommandChannel(keyboard.asHidDevice());

    await expect(channel.request(RazerCommands.getFirmwareVersion)).rejects.toBeInstanceOf(
      RazerKeyboardNotRespondingError,
    );
    await expect(channel.request(RazerCommands.getPollingRate)).rejects.toBeInstanceOf(
      RazerKeyboardNotRespondingError,
    );
  });
});
