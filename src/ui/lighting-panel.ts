import {
  colorToHex,
  effectColors,
  type KeyboardLightingEditor,
  type KeyboardLightingReader,
  type LightingState,
} from "../keyboard/lighting";
import { describeError } from "../shared/describe-error";
import { actionButton, detailRow, element, panelMessage } from "./dom";
import { LightingForm } from "./lighting-form";
import { describeEffect } from "./lighting-format";
import type { Panel } from "./panel";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";

export class LightingPanel implements Panel {
  readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private disposed = false;

  constructor(
    private readonly reader: KeyboardLightingReader,
    private readonly editor: KeyboardLightingEditor | undefined,
  ) {
    this.content = element("div", "lighting__content");
    const refresh = actionButton("Refresh", "secondary", () => void this.load());
    const heading = element("div", "panel-heading", [element("h3", "panel-heading__title", ["Lighting"]), refresh]);
    this.element = element("section", "panel", [heading, this.content]);
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  private async load(): Promise<void> {
    this.show([panelMessage("Reading lighting…")]);
    try {
      this.showState(await this.reader.readLighting());
    } catch (error) {
      this.show([panelMessage(`Could not read the lighting: ${describeError(error)}`)]);
    }
  }

  private showState(state: LightingState, notice?: string): void {
    const editButton = this.editor
      ? [element("div", "status-card__actions", [actionButton("Change lighting", "primary", () => this.edit(state))])]
      : [];
    this.show([...(notice ? [panelMessage(notice)] : []), lightingDetails(state), ...editButton]);
  }

  private edit(state: LightingState): void {
    if (!this.editor) return;
    const form = new LightingForm(state, this.editor, {
      onSaved: (savedState) => this.showState(savedState, SAVED_NOTICE),
      onCancel: () => this.showState(state),
    });
    this.show([form.element]);
  }

  private show(children: readonly Node[]): void {
    if (!this.disposed) this.content.replaceChildren(...children);
  }
}

function lightingDetails(state: LightingState): HTMLDListElement {
  const colors = effectColors(state.effect);
  return element("dl", "details", [
    ...detailRow("Brightness", `${state.brightnessPercent} %`),
    ...detailRow("Effect", describeEffect(state.effect)),
    ...(colors.length > 0 ? [element("dt", "details__label", ["Colors"]), colorSwatches(colors.map(colorToHex))] : []),
  ]);
}

function colorSwatches(hexColors: readonly string[]): HTMLElement {
  return element("dd", "details__value lighting__swatches", hexColors.map((hexColor) => {
    const swatch = element("span", "profile__swatch");
    swatch.style.background = hexColor;
    swatch.title = hexColor;
    return swatch;
  }));
}
