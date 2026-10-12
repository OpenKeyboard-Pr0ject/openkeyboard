import { keyLabel } from "../keyboard/hid-key-names";
import type { MatrixKey } from "../keyboard/matrix-key";
import type {
  KeyboardProfile,
  KeyboardProfileEditor,
  KeyboardProfileReader,
  KeyboardProfileSummary,
  KeyRapidTrigger,
  RapidTriggerSettings,
} from "../keyboard/keyboard-profile";
import { describeError } from "../shared/describe-error";
import { actionButton, detailRow, element } from "./dom";
import type { Panel } from "./panel";
import { ProfileSettingsForm } from "./profile-settings-form";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";

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
    const editButton = this.editor
      ? [element("div", "status-card__actions", [actionButton("Edit settings", "primary", () => this.edit(profile))])]
      : [];
    this.showDetails([...(notice ? [message(notice)] : []), ...profileDetails(profile), ...editButton]);
  }

  private edit(profile: KeyboardProfile): void {
    if (!this.editor) return;
    const isActive = profile.slot === this.overview.activeSlot;
    const form = new ProfileSettingsForm(profile, isActive, this.editor, {
      onSaved: (savedProfile) => this.showProfile(savedProfile, SAVED_NOTICE),
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
    ...keyGroups(
      "Keys with their own actuation point",
      profile.keyActuations,
      (entry) => formatMillimeters(entry.actuationMillimeters),
    ),
    ...keyGroups("Keys with their own Rapid Trigger", profile.keyRapidTriggers, keyRapidTriggerLabel),
  ];
}

function rapidTriggerRows(rapidTrigger: RapidTriggerSettings): HTMLElement[] {
  if (!rapidTrigger.enabled) return detailRow("Rapid Trigger", "Off");
  return [
    ...detailRow("Rapid Trigger", `On, ${formatMillimeters(rapidTrigger.sensitivityMillimeters)} sensitivity`),
    ...detailRow("Continuous Rapid Trigger", rapidTrigger.continuous ? "On" : "Off"),
  ];
}

function keyGroups<Entry extends { readonly key: MatrixKey }>(
  title: string,
  entries: readonly Entry[],
  labelOf: (entry: Entry) => string,
): Node[] {
  if (entries.length === 0) return [];
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) groups.set(labelOf(entry), [...(groups.get(labelOf(entry)) ?? []), entry]);
  const rows = [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, "en-US", { numeric: true }))
    .flatMap(([label, grouped]) => detailRow(label, grouped.map((entry) => keyLabel(entry.key)).join(", ")));
  return [element("h4", "profile__subtitle", [title]), element("dl", "details", rows)];
}

function keyRapidTriggerLabel(keyRapidTrigger: KeyRapidTrigger): string {
  const sensitivity = `On, ${formatMillimeters(keyRapidTrigger.sensitivityMillimeters)}`;
  return keyRapidTrigger.usesProfileSensitivity ? `${sensitivity} (profile sensitivity)` : sensitivity;
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
