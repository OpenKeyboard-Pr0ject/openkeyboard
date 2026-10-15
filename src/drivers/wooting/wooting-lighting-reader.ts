import type { KeyboardLightingReader, LightingState } from "../../keyboard/lighting";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../protocol/wooting/wooting-constants";
import { decodeCurrentProfileIndex, decodeProfileMetadata } from "../../protocol/wooting/wooting-profile-codec";
import { decodeRgbCore, decodeRgbRows } from "../../protocol/wooting/wooting-rgb-codec";

const UPPER_ROWS_START = 0;
const LOWER_ROWS_START = 3;
const EFFECT_LAYERS_DESCRIPTION = "an animated effect, not decoded yet";

export class WootingLightingReader implements KeyboardLightingReader {
  constructor(private readonly commands: WootingCommandChannel) {}

  async readLighting(): Promise<LightingState> {
    const slot = decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
    const metadata = decodeProfileMetadata(await this.commands.request(WootingCommand.getProfileMetadata, [slot]));
    const core = decodeRgbCore(await this.commands.request(WootingCommand.getRgbCore, [slot]));
    const upperRows = await this.commands.request(WootingCommand.getRgbUpperRows, [slot]);
    const lowerRows = await this.commands.request(WootingCommand.getRgbLowerRows, [slot]);
    return {
      brightnessPercent: core.brightnessPercent,
      effect: core.hasEffectLayers
        ? { kind: "unrecognized", description: EFFECT_LAYERS_DESCRIPTION }
        : { kind: "per-key" },
      keyColors: [...decodeRgbRows(upperRows, UPPER_ROWS_START), ...decodeRgbRows(lowerRows, LOWER_ROWS_START)],
      profileName: metadata.name,
    };
  }
}
