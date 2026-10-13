import type {
  DeviceSettings,
  KeyboardDeviceSettingsEditor,
  KeyboardDeviceSettingsReader,
} from "../keyboard/device-settings";
import { describeError } from "../shared/describe-error";
import { DeviceSettingsForm } from "./device-settings-form";
import { formatBattery, formatIdleTimeout, formatPollingRate } from "./device-settings-format";
import { actionButton, detailRow, element, panelMessage } from "./dom";
import type { Panel } from "./panel";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";

export class DeviceSettingsPanel implements Panel {
  readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private disposed = false;

  constructor(
    private readonly reader: KeyboardDeviceSettingsReader,
    private readonly editor: KeyboardDeviceSettingsEditor | undefined,
  ) {
    this.content = element("div", "device-settings__content");
    const refresh = actionButton("Refresh", "secondary", () => void this.load());
    const heading = element("div", "panel-heading", [
      element("h3", "panel-heading__title", ["Battery and performance"]),
      refresh,
    ]);
    this.element = element("section", "panel", [heading, this.content]);
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  private async load(): Promise<void> {
    this.show([panelMessage("Reading device settings…")]);
    try {
      this.showSettings(await this.reader.readDeviceSettings());
    } catch (error) {
      this.show([panelMessage(`Could not read the device settings: ${describeError(error)}`)]);
    }
  }

  private showSettings(settings: DeviceSettings, notice?: string): void {
    const changeButton = actionButton("Change settings", "primary", () => this.edit(settings));
    const editButton = this.editor ? [element("div", "status-card__actions", [changeButton])] : [];
    this.show([...(notice ? [panelMessage(notice)] : []), settingsDetails(settings), ...editButton]);
  }

  private edit(settings: DeviceSettings): void {
    if (!this.editor) return;
    const form = new DeviceSettingsForm(settings, this.editor, {
      onSaved: (savedSettings) => this.showSettings(savedSettings, SAVED_NOTICE),
      onCancel: () => this.showSettings(settings),
    });
    this.show([form.element]);
  }

  private show(children: readonly Node[]): void {
    if (!this.disposed) this.content.replaceChildren(...children);
  }
}

function settingsDetails(settings: DeviceSettings): HTMLDListElement {
  return element("dl", "details", [
    ...detailRow("Battery", formatBattery(settings.battery)),
    ...detailRow("Polling rate", formatPollingRate(settings.pollingRateHz)),
    ...detailRow("Sleep after", formatIdleTimeout(settings.idleTimeoutSeconds)),
  ]);
}
