import {
  type DeviceSettings,
  type DeviceSettingsChange,
  type KeyboardDeviceSettingsEditor,
  type KeyboardDeviceSettingsReader,
  UnsupportedPollingRateError,
} from "../../keyboard/device-settings";
import type { RazerCommandChannel } from "../../protocol/razer/razer-command-channel";
import { RAZER_IDLE_TIME_RANGE, RazerCommands, RazerPollingRateCode } from "../../protocol/razer/razer-constants";
import {
  decodeBatteryLevelPercent,
  decodeCharging,
  decodeIdleTimeSeconds,
  decodePollingRateHz,
  encodeIdleTimeArguments,
  encodePollingRateArguments,
} from "../../protocol/razer/razer-device-codec";
import { assertSettingsKept, type WrittenSetting } from "./razer-write-verification";

export class IdleTimeoutOutOfRangeError extends Error {
  constructor(seconds: number) {
    const { min, max, step } = RAZER_IDLE_TIME_RANGE;
    super(`The sleep timer must be between ${min} and ${max} seconds in steps of ${step} seconds, not ${seconds}.`);
    this.name = "IdleTimeoutOutOfRangeError";
  }
}

export class RazerDeviceSettings implements KeyboardDeviceSettingsReader, KeyboardDeviceSettingsEditor {
  readonly supportedPollingRatesHz = [...RazerPollingRateCode.keys()].sort((first, second) => first - second);
  readonly idleTimeoutRangeSeconds = RAZER_IDLE_TIME_RANGE;

  constructor(private readonly channel: RazerCommandChannel) {}

  async readDeviceSettings(): Promise<DeviceSettings> {
    const pollingRateHz = decodePollingRateHz(await this.channel.request(RazerCommands.getPollingRate));
    const idleTimeoutSeconds = decodeIdleTimeSeconds(await this.channel.request(RazerCommands.getIdleTime));
    const levelPercent = decodeBatteryLevelPercent(await this.channel.request(RazerCommands.getBatteryLevel));
    const charging = decodeCharging(await this.channel.request(RazerCommands.getChargingStatus));
    return { pollingRateHz, idleTimeoutSeconds, battery: { levelPercent, charging } };
  }

  async updateDeviceSettings(change: DeviceSettingsChange): Promise<DeviceSettings> {
    this.validate(change);
    await this.write(change);
    const stored = await this.readDeviceSettings();
    assertSettingsKept(keptSettings(change, stored));
    return stored;
  }

  private async write(change: DeviceSettingsChange): Promise<void> {
    if (change.pollingRateHz !== undefined) {
      await this.channel.request(RazerCommands.setPollingRate, encodePollingRateArguments(change.pollingRateHz));
    }
    if (change.idleTimeoutSeconds !== undefined) {
      await this.channel.request(RazerCommands.setIdleTime, encodeIdleTimeArguments(change.idleTimeoutSeconds));
    }
  }

  private validate(change: DeviceSettingsChange): void {
    const { pollingRateHz, idleTimeoutSeconds } = change;
    if (pollingRateHz !== undefined && !this.supportedPollingRatesHz.includes(pollingRateHz)) {
      throw new UnsupportedPollingRateError(pollingRateHz, this.supportedPollingRatesHz);
    }
    if (idleTimeoutSeconds !== undefined && !isValidIdleTimeout(idleTimeoutSeconds)) {
      throw new IdleTimeoutOutOfRangeError(idleTimeoutSeconds);
    }
  }
}

function keptSettings(change: DeviceSettingsChange, stored: DeviceSettings): WrittenSetting[] {
  const { pollingRateHz, idleTimeoutSeconds } = change;
  return [
    ...(pollingRateHz !== undefined ? [{ name: "polling rate", kept: stored.pollingRateHz === pollingRateHz }] : []),
    ...(idleTimeoutSeconds !== undefined
      ? [{ name: "sleep timer", kept: stored.idleTimeoutSeconds === idleTimeoutSeconds }]
      : []),
  ];
}

function isValidIdleTimeout(seconds: number): boolean {
  const { min, max, step } = RAZER_IDLE_TIME_RANGE;
  return Number.isInteger(seconds) && seconds >= min && seconds <= max && (seconds - min) % step === 0;
}
