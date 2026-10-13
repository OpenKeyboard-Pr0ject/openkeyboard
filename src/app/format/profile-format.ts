import { keyLabel } from "../../keyboard/hid-key-names";
import type { KeyRapidTrigger, RapidTriggerSettings } from "../../keyboard/keyboard-profile";
import type { MatrixKey } from "../../keyboard/matrix-key";
import type { Detail } from "../components/DetailList";

export function formatMillimeters(millimeters: number): string {
  return `${millimeters.toFixed(2)} mm`;
}

export function rapidTriggerDetails(rapidTrigger: RapidTriggerSettings): Detail[] {
  if (!rapidTrigger.enabled) return [{ label: "Rapid Trigger", value: "Off" }];
  return [
    { label: "Rapid Trigger", value: `On, ${formatMillimeters(rapidTrigger.sensitivityMillimeters)} sensitivity` },
    { label: "Continuous Rapid Trigger", value: rapidTrigger.continuous ? "On" : "Off" },
  ];
}

export function keyRapidTriggerLabel(keyRapidTrigger: KeyRapidTrigger): string {
  const sensitivity = `On, ${formatMillimeters(keyRapidTrigger.sensitivityMillimeters)}`;
  return keyRapidTrigger.usesProfileSensitivity ? `${sensitivity} (profile sensitivity)` : sensitivity;
}

export function keyGroupDetails<Entry extends { readonly key: MatrixKey }>(
  entries: readonly Entry[],
  labelOf: (entry: Entry) => string,
): Detail[] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) groups.set(labelOf(entry), [...(groups.get(labelOf(entry)) ?? []), entry]);
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, "en-US", { numeric: true }))
    .map(([label, grouped]) => ({ label, value: grouped.map((entry) => keyLabel(entry.key)).join(", ") }));
}
