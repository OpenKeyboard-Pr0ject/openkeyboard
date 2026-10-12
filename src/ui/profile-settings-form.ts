import type {
  KeyboardProfile,
  KeyboardProfileEditor,
  ProfileSettingsChange,
} from "../keyboard/keyboard-profile";
import { describeError } from "../shared/describe-error";
import { actionButton, element, millimeterInput } from "./dom";
import { KeySettingsSection } from "./key-settings-section";

export interface ProfileSettingsFormCallbacks {
  readonly onSaved: (profile: KeyboardProfile) => void;
  readonly onCancel: () => void;
}

export class ProfileSettingsForm {
  readonly element: HTMLElement;
  private readonly actuation: HTMLInputElement;
  private readonly rapidTriggerEnabled: HTMLInputElement;
  private readonly sensitivity: HTMLInputElement;
  private readonly continuous: HTMLInputElement;
  private readonly keySettings: KeySettingsSection;
  private readonly status: HTMLElement;
  private readonly buttons: HTMLButtonElement[];

  constructor(
    private readonly profile: KeyboardProfile,
    isActiveProfile: boolean,
    private readonly editor: KeyboardProfileEditor,
    private readonly callbacks: ProfileSettingsFormCallbacks,
  ) {
    this.actuation = millimeterInput(profile.actuationMillimeters, editor.actuationRange);
    this.rapidTriggerEnabled = checkbox(profile.rapidTrigger.enabled);
    this.sensitivity = millimeterInput(
      profile.rapidTrigger.sensitivityMillimeters,
      editor.rapidTriggerSensitivityRange,
    );
    this.continuous = checkbox(profile.rapidTrigger.continuous);
    this.keySettings = new KeySettingsSection(profile, {
      actuation: editor.actuationRange,
      sensitivity: editor.rapidTriggerSensitivityRange,
    });
    this.status = element("p", "panel__message");
    this.buttons = [
      actionButton("Save to keyboard", "primary", () => void this.save()),
      actionButton("Cancel", "secondary", () => this.callbacks.onCancel()),
    ];
    this.element = element("form", "settings-form", [
      field("Actuation point (mm)", this.actuation),
      field("Rapid Trigger", this.rapidTriggerEnabled),
      field("Rapid Trigger sensitivity (mm)", this.sensitivity),
      field("Continuous Rapid Trigger", this.continuous),
      this.keySettings.element,
      element("p", "settings-form__note", [targetDescription(profile.name, isActiveProfile)]),
      element("div", "status-card__actions", this.buttons),
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
      this.callbacks.onSaved(await this.editor.updateProfile(this.profile.slot, change));
    } catch (error) {
      this.status.textContent = `Not saved: ${describeError(error)}`;
      this.setBusy(false);
    }
  }

  private collectChange(): ProfileSettingsChange {
    const actuation = this.actuation.valueAsNumber;
    const sensitivity = this.sensitivity.valueAsNumber;
    const current = this.profile;
    const keys = this.keySettings.changes();
    return {
      ...(keys.length > 0 ? { keys } : {}),
      ...(actuation !== current.actuationMillimeters ? { actuationMillimeters: actuation } : {}),
      ...(this.rapidTriggerEnabled.checked !== current.rapidTrigger.enabled
        ? { rapidTriggerEnabled: this.rapidTriggerEnabled.checked } : {}),
      ...(sensitivity !== current.rapidTrigger.sensitivityMillimeters
        ? { rapidTriggerSensitivityMillimeters: sensitivity } : {}),
      ...(this.continuous.checked !== current.rapidTrigger.continuous
        ? { continuousRapidTrigger: this.continuous.checked } : {}),
    };
  }

  private setBusy(busy: boolean): void {
    [this.actuation, this.rapidTriggerEnabled, this.sensitivity, this.continuous, ...this.buttons]
      .forEach((control) => (control.disabled = busy));
    this.keySettings.setDisabled(busy);
  }
}

function targetDescription(profileName: string, isActiveProfile: boolean): string {
  const written = `Changes are written to "${profileName}" and read back to confirm.`;
  return isActiveProfile
    ? written
    : `${written} This profile is not active, so the keyboard keeps using its current profile until you switch.`;
}


function checkbox(checked: boolean): HTMLInputElement {
  const input = element("input", "settings-form__checkbox");
  input.type = "checkbox";
  input.checked = checked;
  return input;
}

function field(labelText: string, control: HTMLInputElement): HTMLLabelElement {
  return element("label", "settings-form__field", [element("span", "details__label", [labelText]), control]);
}
