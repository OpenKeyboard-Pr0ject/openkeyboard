import { keyLabel } from "../keyboard/hid-key-names";
import type {
  KeyActuation,
  KeyboardProfile,
  KeyboardProfileEditor,
  KeyboardProfileReader,
  KeyboardProfileSummary,
  RapidTriggerSettings,
} from "../keyboard/keyboard-profile";
import { describeError } from "../shared/describe-error";
import { actionButton, detailRow, element } from "./dom";
import type { Panel } from "./panel";
import { ProfileSettingsForm } from "./profile-settings-form";

interface ProfileOverview {
  readonly profiles: readonly KeyboardProfileSummary[];
  readonly activeSlot: number;
}

export class ProfilePanel implements Panel {
  readonly element: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly details: HTMLElement;
  private overview: ProfileOverview = { profiles: [], activeSlot: 0 };
  private selectedSlot: number | undefined;
  private disposed = false;

  constructor(
    private readonly reader: KeyboardProfileReader,
    private readonly editor: KeyboardProfileEditor | undefined,
  ) {
    this.tabs = element("div", "profile-tabs");
    this.details = element("div", "profile__details");
    const refresh = actionButton("Refresh", "secondary", () => void this.load());
    const heading = element("div", "panel-heading", [element("h3", "panel-heading__title", ["Profiles"]), refresh]);
    this.element = element("section", "panel", [heading, this.tabs, this.details]);
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  private async load(): Promise<void> {
    this.showDetails([message("Reading profiles…")]);
    try {
      const activeSlot = await this.reader.readActiveSlot();
      this.overview = { profiles: await this.reader.listProfiles(), activeSlot };
      await this.select(this.selectedSlot ?? activeSlot);
    } catch (error) {
      this.showDetails([message(`Could not read the profiles: ${describeError(error)}`)]);
    }
  }

  private async select(slot: number): Promise<void> {
    this.selectedSlot = slot;
    this.renderTabs();
    try {
      this.showProfile(await this.reader.readProfile(slot));
    } catch (error) {
      this.showDetails([message(`Could not read profile ${slot + 1}: ${describeError(error)}`)]);
    }
  }

  private showProfile(profile: KeyboardProfile, notice?: string): void {
    const editButton = this.editor && profile.slot === this.overview.activeSlot
      ? [element("div", "status-card__actions", [actionButton("Edit settings", "primary", () => this.edit(profile))])]
      : [];
    this.showDetails([...(notice ? [message(notice)] : []), ...profileDetails(profile), ...editButton]);
  }

  private edit(profile: KeyboardProfile): void {
    if (!this.editor) return;
    const form = new ProfileSettingsForm(profile, this.editor, {
      onSaved: (savedProfile) => this.showProfile(savedProfile, "Saved to the keyboard and confirmed by reading it back."),
      onCancel: () => this.showProfile(profile),
    });
    this.showDetails([form.element]);
  }

  private renderTabs(): void {
    if (this.disposed) return;
    this.tabs.replaceChildren(...this.overview.profiles.map((profile) => this.profileTab(profile)));
  }

  private profileTab(profile: KeyboardProfileSummary): HTMLButtonElement {
    const isActive = profile.slot === this.overview.activeSlot;
    const tab = element("button", `profile-tab${profile.slot === this.selectedSlot ? " profile-tab--selected" : ""}`, [
      colorSwatch(profile.color),
      profile.name,
      ...(isActive ? [element("span", "profile-tab__badge", ["Active"])] : []),
    ]);
    tab.type = "button";
    tab.addEventListener("click", () => void this.select(profile.slot));
    return tab;
  }

  private showDetails(children: readonly Node[]): void {
    if (!this.disposed) this.details.replaceChildren(...children);
  }
}

function profileDetails(profile: KeyboardProfile): Node[] {
  return [
    element("dl", "details", [
      ...detailRow("Slot", String(profile.slot + 1)),
      ...detailRow("Actuation point", formatMillimeters(profile.actuationMillimeters)),
      ...rapidTriggerRows(profile.rapidTrigger),
    ]),
    ...keyActuationGroups(profile.keyActuations),
  ];
}

function rapidTriggerRows(rapidTrigger: RapidTriggerSettings): HTMLElement[] {
  if (!rapidTrigger.enabled) return detailRow("Rapid Trigger", "Off");
  return [
    ...detailRow("Rapid Trigger", `On, ${formatMillimeters(rapidTrigger.sensitivityMillimeters)} sensitivity`),
    ...detailRow("Continuous Rapid Trigger", rapidTrigger.continuous ? "On" : "Off"),
  ];
}

function keyActuationGroups(keyActuations: readonly KeyActuation[]): Node[] {
  if (keyActuations.length === 0) return [];
  const rows = [...groupByActuation(keyActuations).entries()]
    .sort(([first], [second]) => first - second)
    .flatMap(([millimeters, keys]) => detailRow(
      formatMillimeters(millimeters),
      keys.map((keyActuation) => keyLabel(keyActuation.key)).join(", "),
    ));
  return [element("h4", "profile__subtitle", ["Keys with their own actuation point"]), element("dl", "details", rows)];
}

function groupByActuation(keyActuations: readonly KeyActuation[]): Map<number, KeyActuation[]> {
  const groups = new Map<number, KeyActuation[]>();
  for (const keyActuation of keyActuations) {
    groups.set(keyActuation.actuationMillimeters, [...(groups.get(keyActuation.actuationMillimeters) ?? []), keyActuation]);
  }
  return groups;
}

function colorSwatch(color: string): HTMLElement {
  const swatch = element("span", "profile__swatch");
  swatch.style.background = color;
  return swatch;
}

function message(text: string): HTMLElement {
  return element("p", "panel__message", [text]);
}

function formatMillimeters(millimeters: number): string {
  return `${millimeters.toFixed(2)} mm`;
}
