import { keyLabel } from "../keyboard/hid-key-names";
import type {
  KeyActuationSetting,
  KeyboardProfile,
  KeyRapidTriggerSetting,
  KeySettingsChange,
  SettingRange,
} from "../keyboard/keyboard-profile";
import type { MatrixKey } from "../keyboard/matrix-key";
import { actionButton, element, millimeterInput } from "./dom";

interface KeySettings {
  readonly actuation: KeyActuationSetting;
  readonly rapidTrigger: KeyRapidTriggerSetting;
}

export interface KeySettingRanges {
  readonly actuation: SettingRange;
  readonly sensitivity: SettingRange;
}

const FOLLOW_PROFILE = "follow-profile";
const PROFILE_SENSITIVITY = "profile-sensitivity";
const CUSTOM = "custom";

class KeySettingsRow {
  readonly element: HTMLElement;
  private readonly actuationMode: HTMLSelectElement;
  private readonly actuationValue: HTMLInputElement;
  private readonly rapidTriggerMode: HTMLSelectElement;
  private readonly sensitivityValue: HTMLInputElement;

  constructor(
    readonly key: MatrixKey,
    private readonly original: KeySettings,
    ranges: KeySettingRanges,
    defaults: { actuationMillimeters: number; sensitivityMillimeters: number },
  ) {
    this.actuationMode = select([[FOLLOW_PROFILE, "Profile actuation"], [CUSTOM, "Custom"]], original.actuation.kind);
    this.actuationValue = millimeterInput(
      original.actuation.kind === CUSTOM ? original.actuation.millimeters : defaults.actuationMillimeters,
      ranges.actuation,
    );
    this.rapidTriggerMode = select(
      [
        [FOLLOW_PROFILE, "Profile Rapid Trigger"],
        [PROFILE_SENSITIVITY, "On, profile sensitivity"],
        [CUSTOM, "On, custom"],
      ],
      original.rapidTrigger.kind,
    );
    this.sensitivityValue = millimeterInput(
      original.rapidTrigger.kind === CUSTOM
        ? original.rapidTrigger.sensitivityMillimeters
        : defaults.sensitivityMillimeters,
      ranges.sensitivity,
    );
    [this.actuationMode, this.rapidTriggerMode]
      .forEach((control) => control.addEventListener("change", () => this.syncInputs()));
    const reset = actionButton("Reset", "secondary", () => this.resetToProfile());
    this.element = element("div", "key-settings__row", [
      element("span", "key-settings__key", [keyLabel(key)]),
      element("div", "key-settings__controls", [this.actuationMode, this.actuationValue]),
      element("div", "key-settings__controls", [this.rapidTriggerMode, this.sensitivityValue]),
      reset,
    ]);
    this.syncInputs();
  }

  change(): KeySettingsChange | undefined {
    const actuation = this.actuation();
    const rapidTrigger = this.rapidTrigger();
    const actuationChanged = JSON.stringify(actuation) !== JSON.stringify(this.original.actuation);
    const rapidTriggerChanged = JSON.stringify(rapidTrigger) !== JSON.stringify(this.original.rapidTrigger);
    if (!actuationChanged && !rapidTriggerChanged) return undefined;
    return {
      key: this.key,
      ...(actuationChanged ? { actuation } : {}),
      ...(rapidTriggerChanged ? { rapidTrigger } : {}),
    };
  }

  setDisabled(disabled: boolean): void {
    [this.actuationMode, this.actuationValue, this.rapidTriggerMode, this.sensitivityValue]
      .forEach((control) => (control.disabled = disabled));
    if (!disabled) this.syncInputs();
  }

  private actuation(): KeyActuationSetting {
    return this.actuationMode.value === CUSTOM
      ? { kind: "custom", millimeters: this.actuationValue.valueAsNumber }
      : { kind: "follow-profile" };
  }

  private rapidTrigger(): KeyRapidTriggerSetting {
    if (this.rapidTriggerMode.value === CUSTOM) {
      return { kind: "custom", sensitivityMillimeters: this.sensitivityValue.valueAsNumber };
    }
    return this.rapidTriggerMode.value === PROFILE_SENSITIVITY
      ? { kind: "profile-sensitivity" }
      : { kind: "follow-profile" };
  }

  private resetToProfile(): void {
    this.actuationMode.value = FOLLOW_PROFILE;
    this.rapidTriggerMode.value = FOLLOW_PROFILE;
    this.syncInputs();
  }

  private syncInputs(): void {
    this.actuationValue.disabled = this.actuationMode.value !== CUSTOM;
    this.sensitivityValue.disabled = this.rapidTriggerMode.value !== CUSTOM;
  }
}

export class KeySettingsSection {
  readonly element: HTMLElement;
  private readonly rows: KeySettingsRow[] = [];
  private readonly rowList: HTMLElement;
  private readonly keyPicker: HTMLSelectElement;
  private readonly addButton: HTMLButtonElement;

  constructor(private readonly profile: KeyboardProfile, private readonly ranges: KeySettingRanges) {
    this.rowList = element("div", "key-settings__rows");
    this.keyPicker = element("select", "settings-form__select");
    this.addButton = actionButton("Add key", "secondary", () => this.addSelectedKey());
    this.element = element("section", "key-settings", [
      element("h4", "profile__subtitle", ["Per-key settings"]),
      this.rowList,
      element("div", "key-settings__add", [this.keyPicker, this.addButton]),
    ]);
    initialKeySettings(profile).forEach((settings, key) => this.addRow(key, settings));
    this.refreshKeyPicker();
  }

  changes(): KeySettingsChange[] {
    return this.rows.map((row) => row.change()).filter((change): change is KeySettingsChange => change !== undefined);
  }

  setDisabled(disabled: boolean): void {
    this.rows.forEach((row) => row.setDisabled(disabled));
    this.keyPicker.disabled = disabled;
    this.addButton.disabled = disabled;
  }

  private addSelectedKey(): void {
    const key = this.profile.layout.find((candidate) => keyId(candidate) === this.keyPicker.value);
    if (!key) return;
    this.addRow(key, { actuation: { kind: "follow-profile" }, rapidTrigger: { kind: "follow-profile" } });
    this.refreshKeyPicker();
  }

  private addRow(key: MatrixKey, settings: KeySettings): void {
    const row = new KeySettingsRow(key, settings, this.ranges, {
      actuationMillimeters: this.profile.actuationMillimeters,
      sensitivityMillimeters: this.profile.rapidTrigger.sensitivityMillimeters,
    });
    this.rows.push(row);
    this.rowList.append(row.element);
  }

  private refreshKeyPicker(): void {
    const listed = new Set(this.rows.map((row) => keyId(row.key)));
    const options = this.profile.layout
      .filter((key) => !listed.has(keyId(key)))
      .map((key) => {
        const option = element("option", "", [keyLabel(key)]);
        option.value = keyId(key);
        return option;
      });
    this.keyPicker.replaceChildren(...options);
  }
}

function initialKeySettings(profile: KeyboardProfile): Map<MatrixKey, KeySettings> {
  const byId = new Map<string, { key: MatrixKey; settings: KeySettings }>();
  const entryFor = (key: MatrixKey) => byId.get(keyId(key))
    ?? { key, settings: { actuation: { kind: "follow-profile" }, rapidTrigger: { kind: "follow-profile" } } };
  for (const { key, actuationMillimeters } of profile.keyActuations) {
    const entry = entryFor(key);
    const actuation: KeyActuationSetting = { kind: "custom", millimeters: actuationMillimeters };
    byId.set(keyId(key), { key, settings: { ...entry.settings, actuation } });
  }
  for (const { key, usesProfileSensitivity, sensitivityMillimeters } of profile.keyRapidTriggers) {
    const entry = entryFor(key);
    const rapidTrigger: KeyRapidTriggerSetting = usesProfileSensitivity
      ? { kind: "profile-sensitivity" }
      : { kind: "custom", sensitivityMillimeters };
    byId.set(keyId(key), { key, settings: { ...entry.settings, rapidTrigger } });
  }
  return new Map([...byId.values()].map(({ key, settings }) => [key, settings]));
}

function keyId(key: MatrixKey): string {
  return `${key.matrixRow}:${key.matrixColumn}`;
}

function select(options: ReadonlyArray<readonly [string, string]>, selected: string): HTMLSelectElement {
  const control = element("select", "settings-form__select", options.map(([value, label]) => {
    const option = element("option", "", [label]);
    option.value = value;
    return option;
  }));
  control.value = selected;
  return control;
}
