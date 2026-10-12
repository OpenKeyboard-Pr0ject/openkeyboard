import type {
  KeyActuation,
  KeyboardProfile,
  KeyboardProfileReader,
  KeyboardProfileSummary,
  KeyRapidTrigger,
  RapidTriggerSettings,
} from "../../keyboard/keyboard-profile";
import type { MatrixKey } from "../../keyboard/matrix-key";
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
  type WootingProfileMetadata,
  type WootingProfileSettings,
} from "../../protocol/wooting/wooting-profile-codec";
import { decodeRapidTriggerKeys } from "../../protocol/wooting/wooting-per-key-codec";

const MAX_PROFILE_SLOTS = 4;
const BASE_LAYOUT_SLOT = 0;

export class WootingProfileReader implements KeyboardProfileReader {
  constructor(private readonly commands: WootingCommandChannel) {}

  async readActiveSlot(): Promise<number> {
    return decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
  }

  async listProfiles(): Promise<KeyboardProfileSummary[]> {
    const summaries: KeyboardProfileSummary[] = [];
    for (let slot = 0; slot < MAX_PROFILE_SLOTS; slot += 1) {
      const metadata = await this.readMetadata(slot);
      if (metadata.name === "") break;
      summaries.push({ slot, name: metadata.name, color: metadata.color });
    }
    return summaries;
  }

  async readProfile(slot: number): Promise<KeyboardProfile> {
    const metadata = await this.readMetadata(slot);
    const settings = decodeProfileSettings(await this.commands.request(WootingCommand.getKeyboardProfile, [slot]));
    const rapidTrigger = rapidTriggerFrom(settings);
    const layout = await this.readLayout(slot);
    return {
      slot,
      name: metadata.name,
      color: metadata.color,
      actuationMillimeters: wootingTravelToMillimeters(settings.actuationRaw),
      rapidTrigger,
      keyActuations: await this.readKeyActuations(slot, layout),
      keyRapidTriggers: await this.readKeyRapidTriggers(slot, layout, rapidTrigger.sensitivityMillimeters),
      layout,
    };
  }

  private async readMetadata(slot: number): Promise<WootingProfileMetadata> {
    return decodeProfileMetadata(await this.commands.request(WootingCommand.getProfileMetadata, [slot]));
  }

  private async readLayout(slot: number): Promise<MatrixKey[]> {
    const layout = decodeKeyMapping(await this.commands.request(WootingCommand.getKeyMapping, [slot]));
    if (layout.length > 0 || slot === BASE_LAYOUT_SLOT) return layout;
    return this.readLayout(BASE_LAYOUT_SLOT);
  }

  private async readKeyActuations(slot: number, layout: readonly MatrixKey[]): Promise<KeyActuation[]> {
    const overrides = decodeActuationOverrides(await this.commands.request(WootingCommand.getActuationProfile, [slot]));
    return overrides.map((override) => ({
      key: matrixKeyAt(layout, override.matrixPosition),
      actuationMillimeters: wootingTravelToMillimeters(override.actuationRaw),
    }));
  }

  private async readKeyRapidTriggers(
    slot: number,
    layout: readonly MatrixKey[],
    profileSensitivityMillimeters: number,
  ): Promise<KeyRapidTrigger[]> {
    const keys = decodeRapidTriggerKeys(await this.commands.request(WootingCommand.getPerKeyRapidTrigger, [slot]));
    return keys.map(({ matrixPosition, setting }) => ({
      key: matrixKeyAt(layout, matrixPosition),
      usesProfileSensitivity: setting.kind === "profile-sensitivity",
      sensitivityMillimeters: setting.kind === "custom-sensitivity"
        ? wootingTravelToMillimeters(setting.sensitivityRaw)
        : profileSensitivityMillimeters,
    }));
  }
}

function rapidTriggerFrom(settings: WootingProfileSettings): RapidTriggerSettings {
  return {
    enabled: settings.rapidTriggerEnabled,
    sensitivityMillimeters: wootingTravelToMillimeters(settings.rapidTriggerSensitivityRaw),
    continuous: settings.continuousRapidTriggerEnabled,
  };
}
