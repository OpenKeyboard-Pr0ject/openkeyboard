import {
  BRIGHTNESS_PERCENT_RANGE,
  type KeyboardLightingEditor,
  type LightingChange,
  type LightingState,
  sameLightingEffect,
  type WritableLightingEffectKind,
} from "../keyboard/lighting";
import { describeError } from "../shared/describe-error";
import { actionButton, element, formField, select } from "./dom";
import { type EffectOptions, effectOptionsFor } from "./lighting-effect-options";
import { EFFECT_LABELS } from "./lighting-format";

export interface LightingFormCallbacks {
  readonly onSaved: (state: LightingState) => void;
  readonly onCancel: () => void;
}

export class LightingForm {
  readonly element: HTMLFormElement;
  private readonly brightness: HTMLInputElement;
  private readonly effectKind: HTMLSelectElement;
  private readonly effectControls: HTMLElement;
  private readonly status: HTMLElement;
  private effectOptions: EffectOptions;

  constructor(
    private readonly current: LightingState,
    private readonly editor: KeyboardLightingEditor,
    private readonly callbacks: LightingFormCallbacks,
  ) {
    this.brightness = brightnessSlider(current.brightnessPercent);
    const brightnessValue = element("output", "settings-form__value", [`${current.brightnessPercent} %`]);
    this.brightness.addEventListener("input", () => (brightnessValue.value = `${this.brightness.value} %`));
    this.effectKind = select(
      editor.supportedEffects.map((kind) => [kind, EFFECT_LABELS[kind]] as const),
      this.initialEffectKind(),
    );
    this.effectControls = element("div", "settings-form__group");
    this.effectOptions = this.showEffectOptions();
    this.effectKind.addEventListener("change", () => (this.effectOptions = this.showEffectOptions()));
    this.status = element("p", "panel__message");
    this.element = element("form", "settings-form", [
      formField("Brightness", element("span", "settings-form__slider", [this.brightness, brightnessValue])),
      formField("Effect", this.effectKind),
      this.effectControls,
      element("p", "settings-form__note", ["Changes are saved on the keyboard and read back to confirm."]),
      element("div", "status-card__actions", [
        actionButton("Save to keyboard", "primary", () => void this.save()),
        actionButton("Cancel", "secondary", () => this.callbacks.onCancel()),
      ]),
      this.status,
    ]);
    this.element.addEventListener("submit", (event) => event.preventDefault());
  }

  private initialEffectKind(): WritableLightingEffectKind {
    const currentKind = this.current.effect.kind;
    const supported = this.editor.supportedEffects.find((kind) => kind === currentKind);
    return supported ?? this.editor.supportedEffects[0];
  }

  private showEffectOptions(): EffectOptions {
    const kind = this.effectKind.value as WritableLightingEffectKind;
    const options = effectOptionsFor(kind, this.current.effect, this.editor.maximumEffectColors);
    this.effectControls.replaceChildren(...options.controls);
    return options;
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
      this.callbacks.onSaved(await this.editor.updateLighting(change));
    } catch (error) {
      this.status.textContent = `Not saved: ${describeError(error)}`;
      this.setBusy(false);
    }
  }

  private collectChange(): LightingChange {
    const brightnessPercent = this.brightness.valueAsNumber;
    const effect = this.effectOptions.effect();
    return {
      ...(brightnessPercent !== this.current.brightnessPercent ? { brightnessPercent } : {}),
      ...(!sameLightingEffect(effect, this.current.effect) ? { effect } : {}),
    };
  }

  private setBusy(busy: boolean): void {
    this.element.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")
      .forEach((control) => (control.disabled = busy));
  }
}

function brightnessSlider(percent: number): HTMLInputElement {
  const slider = element("input", "settings-form__range");
  slider.type = "range";
  slider.min = String(BRIGHTNESS_PERCENT_RANGE.min);
  slider.max = String(BRIGHTNESS_PERCENT_RANGE.max);
  slider.step = String(BRIGHTNESS_PERCENT_RANGE.step);
  slider.value = String(percent);
  return slider;
}
