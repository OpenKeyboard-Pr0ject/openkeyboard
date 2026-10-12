import type {
  KeyActuation,
  KeyboardProfile,
  KeyboardProfileReader,
  RapidTriggerSettings,
} from "../../keyboard/keyboard-profile";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../protocol/wooting/wooting-constants";
import {
  decodeActuationOverrides,
  decodeCurrentProfileIndex,
  decodeKeyMapping,
  decodeProfileMetadata,
  decodeProfileSettings,
  matrixKeyAt,
  wootingTravelToMillimeters,
  type WootingProfileSettings,
} from "../../protocol/wooting/wooting-profile-codec";

function rapidTriggerFrom(settings: WootingProfileSettings): RapidTriggerSettings {
  return {
    enabled: settings.rapidTriggerEnabled,
    sensitivityMillimeters: wootingTravelToMillimeters(settings.rapidTriggerSensitivityRaw),
    continuous: settings.continuousRapidTriggerEnabled,
  };
}

export class WootingProfileReader implements KeyboardProfileReader {
  constructor(private readonly commands: WootingCommandChannel) {}

  async readActiveProfile(): Promise<KeyboardProfile> {
    const slot = decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
    const metadata = decodeProfileMetadata(await this.commands.request(WootingCommand.getProfileMetadata));
    const settings = decodeProfileSettings(await this.commands.request(WootingCommand.getKeyboardProfile));
    return {
      slot,
      name: metadata.name,
      color: metadata.color,
      actuationMillimeters: wootingTravelToMillimeters(settings.actuationRaw),
      rapidTrigger: rapidTriggerFrom(settings),
      keyActuations: await this.readKeyActuations(),
    };
  }

  private async readKeyActuations(): Promise<KeyActuation[]> {
    const layout = decodeKeyMapping(await this.commands.request(WootingCommand.getKeyMapping));
    const overrides = decodeActuationOverrides(await this.commands.request(WootingCommand.getActuationProfile));
    return overrides.map((override) => ({
      key: matrixKeyAt(layout, override.matrixPosition),
      actuationMillimeters: wootingTravelToMillimeters(override.actuationRaw),
    }));
  }
}
