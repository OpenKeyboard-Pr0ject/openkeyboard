import { keyLabel } from "../keyboard/hid-key-names";
import type {
  KeyActuation,
  KeyboardProfile,
  KeyboardProfileReader,
  RapidTriggerSettings,
} from "../keyboard/keyboard-profile";
import { describeError } from "../shared/describe-error";
import { actionButton, detailRow, element } from "./dom";
import type { Panel } from "./panel";

export class ProfilePanel implements Panel {
  readonly element: HTMLElement;
  private readonly content: HTMLElement;
  private disposed = false;

  constructor(private readonly reader: KeyboardProfileReader) {
    this.content = element("div", "profile__content");
    const refresh = actionButton("Refresh", "secondary", () => void this.load());
    const heading = element("div", "panel-heading", [element("h3", "panel-heading__title", ["Active profile"]), refresh]);
    this.element = element("section", "panel", [heading, this.content]);
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  private async load(): Promise<void> {
    this.show([element("p", "panel__message", ["Reading profile…"])]);
    try {
      const profile = await this.reader.readActiveProfile();
      this.show(profileDetails(profile));
    } catch (error) {
      this.show([element("p", "panel__message", [`Could not read the profile: ${describeError(error)}`])]);
    }
  }

  private show(children: readonly Node[]): void {
    if (!this.disposed) this.content.replaceChildren(...children);
  }
}

function profileDetails(profile: KeyboardProfile): Node[] {
  const swatch = element("span", "profile__swatch");
  swatch.style.background = profile.color;
  const title = element("p", "profile__name", [swatch, profile.name, element("span", "profile__slot", [
    `Slot ${profile.slot + 1}`,
  ])]);
  return [
    title,
    element("dl", "details", [
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

function formatMillimeters(millimeters: number): string {
  return `${millimeters.toFixed(1)} mm`;
}
