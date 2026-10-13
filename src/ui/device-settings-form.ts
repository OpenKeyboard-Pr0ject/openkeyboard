import type {
  DeviceSettings,
  DeviceSettingsChange,
  KeyboardDeviceSettingsEditor,
} from "../keyboard/device-settings";
import { describeError } from "../shared/describe-error";
import { actionButton, element, formField, select } from "./dom";
import { formatIdleTimeout, formatPollingRate } from "./device-settings-format";

export interface DeviceSettingsFormCallbacks {
  readonly onSaved: (settings: DeviceSettings) => void;
  readonly onCancel: () => void;
}

export class DeviceSettingsForm {
  readonly element: HTMLFormElement;
  private readonly pollingRate: HTMLSelectElement;
  private readonly idleTimeout: HTMLSelectElement;
  private readonly status: HTMLElement;

  constructor(
    private readonly current: DeviceSettings,
    private readonly editor: KeyboardDeviceSettingsEditor,
    private readonly callbacks: DeviceSettingsFormCallbacks,
  ) {
    this.pollingRate = select(
      editor.supportedPollingRatesHz.map((rate) => [String(rate), formatPollingRate(rate)] as const),
      String(current.pollingRateHz),
    );
    const idleTimeoutSeconds = current.idleTimeoutSeconds;
    this.idleTimeout = select(idleTimeoutChoices(editor, idleTimeoutSeconds), String(idleTimeoutSeconds));
    this.status = element("p", "panel__message");
    this.element = element("form", "settings-form", [
      formField("Polling rate", this.pollingRate),
      formField("Sleep after", this.idleTimeout),
      element("p", "settings-form__note", [
        "The sleep timer applies in wireless mode. Changes are saved on the keyboard and read back to confirm.",
      ]),
      element("div", "status-card__actions", [
        actionButton("Save to keyboard", "primary", () => void this.save()),
        actionButton("Cancel", "secondary", () => this.callbacks.onCancel()),
      ]),
      this.status,
    ]);
    this.element.addEventListener("submit", (event) => event.preventDefault());
  }

  private async save(): Promise<void> {
    const change = this.collectChange();
    if (Object.keys(change).length === 0) {
      this.status.textContent = "Nothing changed.";
      return;
    }
    this.setBusy(true);
    this.status.textContent = "Writing to the keyboard…";
    try {
      this.callbacks.onSaved(await this.editor.updateDeviceSettings(change));
    } catch (error) {
      this.status.textContent = `Not saved: ${describeError(error)}`;
      this.setBusy(false);
    }
  }

  private collectChange(): DeviceSettingsChange {
    const pollingRateHz = Number(this.pollingRate.value);
    const idleTimeoutSeconds = Number(this.idleTimeout.value);
    return {
      ...(pollingRateHz !== this.current.pollingRateHz ? { pollingRateHz } : {}),
      ...(idleTimeoutSeconds !== this.current.idleTimeoutSeconds ? { idleTimeoutSeconds } : {}),
    };
  }

  private setBusy(busy: boolean): void {
    this.element.querySelectorAll<HTMLSelectElement | HTMLButtonElement>("select, button")
      .forEach((control) => (control.disabled = busy));
  }
}

function idleTimeoutChoices(
  editor: KeyboardDeviceSettingsEditor,
  currentSeconds: number,
): Array<readonly [string, string]> {
  const { min, max, step } = editor.idleTimeoutRangeSeconds;
  const steps = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);
  const seconds = steps.includes(currentSeconds) ? steps : [...steps, currentSeconds].sort((a, b) => a - b);
  return seconds.map((value) => [String(value), formatIdleTimeout(value)] as const);
}
