import type { KeyboardProfile } from "../../../keyboard/keyboard-profile";
import { SectionLabel } from "../../components/Card";
import { DetailList, type Detail } from "../../components/DetailList";
import {
  formatMillimeters,
  keyGroupDetails,
  keyRapidTriggerLabel,
  rapidTriggerDetails,
} from "../../format/profile-format";

export function ProfileDetails({ profile }: { readonly profile: KeyboardProfile }) {
  return (
    <div className="flex flex-col gap-5">
      <DetailList
        details={[
          { label: "Slot", value: String(profile.slot + 1) },
          { label: "Actuation point", value: formatMillimeters(profile.actuationMillimeters) },
          ...rapidTriggerDetails(profile.rapidTrigger),
        ]}
      />
      <KeyGroup
        title="Keys with their own actuation point"
        details={keyGroupDetails(profile.keyActuations, (entry) => formatMillimeters(entry.actuationMillimeters))}
      />
      <KeyGroup
        title="Keys with their own Rapid Trigger"
        details={keyGroupDetails(profile.keyRapidTriggers, keyRapidTriggerLabel)}
      />
    </div>
  );
}

function KeyGroup({ title, details }: { readonly title: string; readonly details: readonly Detail[] }) {
  if (details.length === 0) return null;
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <DetailList details={details} />
    </div>
  );
}
