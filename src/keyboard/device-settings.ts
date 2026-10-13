import type { SettingRange } from "./keyboard-profile";

export interface BatteryStatus {
  readonly levelPercent: number;
  readonly charging: boolean;
}

export interface DeviceSettings {
  readonly pollingRateHz: number;
  readonly idleTimeoutSeconds: number;
  readonly battery: BatteryStatus;
}

export interface DeviceSettingsChange {
  readonly pollingRateHz?: number;
  readonly idleTimeoutSeconds?: number;
}

export interface KeyboardDeviceSettingsReader {
  readDeviceSettings(): Promise<DeviceSettings>;
}

export interface KeyboardDeviceSettingsEditor {
  readonly supportedPollingRatesHz: readonly number[];
  readonly idleTimeoutRangeSeconds: SettingRange;
  updateDeviceSettings(change: DeviceSettingsChange): Promise<DeviceSettings>;
}

export class UnsupportedPollingRateError extends Error {
  constructor(pollingRateHz: number, supportedPollingRatesHz: readonly number[]) {
    super(`The keyboard supports ${supportedPollingRatesHz.join(", ")} Hz, not ${pollingRateHz} Hz.`);
    this.name = "UnsupportedPollingRateError";
  }
}
