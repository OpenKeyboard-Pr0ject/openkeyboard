import type { BatteryStatus } from "../../keyboard/device-settings";

const SECONDS_PER_MINUTE = 60;

export function formatPollingRate(pollingRateHz: number): string {
  return `${pollingRateHz} Hz`;
}

export function formatIdleTimeout(seconds: number): string {
  if (seconds % SECONDS_PER_MINUTE !== 0) return `${seconds} seconds`;
  const minutes = seconds / SECONDS_PER_MINUTE;
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

export function formatBattery(battery: BatteryStatus): string {
  return battery.charging ? `${battery.levelPercent} %, charging` : `${battery.levelPercent} %`;
}
