import { describe, expect, it } from "vitest";
import { WootingLightingFrameReader } from "../../src/drivers/wooting/wooting-lighting-frame-reader";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import { replyCarrying, typingWaveRgbFramePayload } from "../fakes/wooting-80he-captures";

describe("WootingLightingFrameReader", () => {
  it("asks the keyboard for the frame it shows and maps it to matrix positions", async () => {
    const commands: number[] = [];
    const keyboard = new FakeHidDevice({
      respond: (_reportId, data) => {
        commands.push(data[2]);
        return replyCarrying(data[2], typingWaveRgbFramePayload);
      },
    });
    const reader = new WootingLightingFrameReader(
      new WootingCommandChannel(keyboard.asHidDevice()),
      { rows: 6, columns: 17 },
    );

    const frame = await reader.readFrame();

    expect(commands).toEqual([WootingCommand.getRgbFrame]);
    expect(frame).toHaveLength(102);
    expect(frame.find((key) => key.matrixRow === 3 && key.matrixColumn === 14)?.color)
      .toEqual({ red: 255, green: 113, blue: 0 });
  });
});
