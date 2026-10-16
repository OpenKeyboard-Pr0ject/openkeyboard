import type { KeyColor, LightingFrameReader } from "../../keyboard/lighting";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../protocol/wooting/wooting-constants";
import { decodeRgbFrame, type WootingRgbFrameShape } from "../../protocol/wooting/wooting-rgb-codec";

export class WootingLightingFrameReader implements LightingFrameReader {
  constructor(
    private readonly commands: WootingCommandChannel,
    private readonly shape: WootingRgbFrameShape,
  ) {}

  async readFrame(): Promise<readonly KeyColor[]> {
    return decodeRgbFrame(await this.commands.request(WootingCommand.getRgbFrame), this.shape);
  }
}
