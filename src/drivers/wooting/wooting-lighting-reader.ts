import type { KeyboardLightingReader, LightingEffect, LightingState } from "../../keyboard/lighting";
import {
  baseHidesKeyColors,
  describeLayeredEffects,
  type LayeredEffects,
} from "../../keyboard/lighting-effects";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../protocol/wooting/wooting-constants";
import { decodeCurrentProfileIndex, decodeProfileMetadata } from "../../protocol/wooting/wooting-profile-codec";
import { decodeRgbCore, decodeRgbRows } from "../../protocol/wooting/wooting-rgb-codec";
import { decodeRgbEffects, WootingEffectId } from "../../protocol/wooting/wooting-rgb-effects-codec";
import { WOOTING_EFFECT_CATALOG } from "./wooting-effect-catalog";
import { type StoredRgbParts, WootingRgbPreviewState } from "./wooting-rgb-preview-state";

const UPPER_ROWS_START = 0;
const LOWER_ROWS_START = 3;

export class WootingLightingReader implements KeyboardLightingReader {
  constructor(
    private readonly commands: WootingCommandChannel,
    readonly previewState = new WootingRgbPreviewState(),
  ) {}

  async readLighting(): Promise<LightingState> {
    const slot = decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
    const metadata = decodeProfileMetadata(await this.commands.request(WootingCommand.getProfileMetadata, [slot]));
    const { core, upperRows, lowerRows } = this.previewState.storedWhilePending(slot) ?? await this.readParts(slot);
    const layeredEffects = decodeRgbEffects(core);
    return {
      brightnessPercent: decodeRgbCore(core).brightnessPercent,
      effect: lightingEffectOf(layeredEffects),
      keyColors: [...decodeRgbRows(upperRows, UPPER_ROWS_START), ...decodeRgbRows(lowerRows, LOWER_ROWS_START)],
      effectHidesKeyColors: baseHidesKeyColors(WOOTING_EFFECT_CATALOG, layeredEffects),
      layeredEffects,
      profileName: metadata.name,
    };
  }

  private async readParts(slot: number): Promise<StoredRgbParts> {
    return {
      core: await this.commands.request(WootingCommand.getRgbCore, [slot]),
      upperRows: await this.commands.request(WootingCommand.getRgbUpperRows, [slot]),
      lowerRows: await this.commands.request(WootingCommand.getRgbLowerRows, [slot]),
    };
  }
}

function lightingEffectOf(effects: LayeredEffects): LightingEffect {
  const showsOnlyKeyColors = effects.base.effectId === WootingEffectId.static && effects.effectLayers.length === 0;
  if (showsOnlyKeyColors) return { kind: "per-key" };
  return { kind: "layered", description: describeLayeredEffects(WOOTING_EFFECT_CATALOG, effects) };
}
