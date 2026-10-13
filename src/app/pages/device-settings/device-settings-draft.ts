import type {
  DeviceSettings,
  DeviceSettingsChange,
  KeyboardDeviceSettingsEditor,
} from "../../../keyboard/device-settings";
import type { SelectOption } from "../../components/inputs";
import { formatIdleTimeout, formatPollingRate } from "../../format/device-settings-format";

export function pollingRateOptions(editor: KeyboardDeviceSettingsEditor): SelectOption[] {
  return editor.supportedPollingRatesHz.map((rate) => ({ value: String(rate), label: formatPollingRate(rate) }));
}

export function idleTimeoutOptions(editor: KeyboardDeviceSettingsEditor, currentSeconds: number): SelectOption[] {
  const { min, max, step } = editor.idleTimeoutRangeSeconds;
  const steps = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);
  const seconds = steps.includes(currentSeconds) ? steps : [...steps, currentSeconds].sort((a, b) => a - b);
  return seconds.map((value) => ({ value: String(value), label: formatIdleTimeout(value) }));
}

export function deviceSettingsChange(
  current: DeviceSettings,
  pollingRateHz: number,
  idleTimeoutSeconds: number,
): DeviceSettingsChange {
  return {
    ...(pollingRateHz !== current.pollingRateHz ? { pollingRateHz } : {}),
    ...(idleTimeoutSeconds !== current.idleTimeoutSeconds ? { idleTimeoutSeconds } : {}),
  };
}
