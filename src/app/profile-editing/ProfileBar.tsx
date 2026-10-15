import { Button } from "../components/Button";
import { Badge, Callout } from "../components/feedback";
import { SelectInput } from "../components/inputs";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { useProfileEditing } from "./ProfileEditingContext";

const READ_ONLY_EXPLANATION = "Editing is offered only on keyboards whose writes were tested on real hardware.";

export function ProfileBar() {
  const editing = useProfileEditing();
  const profile = editing.loaded.profile;
  const color = editing.profiles.find((summary) => summary.slot === profile?.slot)?.color ?? "var(--app-faint)";
  const isBusy = editing.isSaving || editing.loaded.status === "loading";
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-wrap items-center gap-4 rounded-lg bg-panel px-4 py-3 md:min-h-20 md:px-5">
        <ProfileAvatar color={color} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold text-muted">Profile</span>
          <SelectInput
            className="max-w-72"
            label="Profile"
            value={profile ? String(profile.slot) : ""}
            disabled={editing.isDirty || isBusy}
            options={editing.profiles.map((summary) => ({
              value: String(summary.slot),
              label: summary.slot === editing.activeSlot ? `${summary.name} (active)` : summary.name,
            }))}
            onChange={(slot) => editing.selectSlot(Number(slot))}
          />
        </div>
        {editing.editor ? (
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="ghost" disabled={!editing.isDirty || isBusy} onClick={editing.discard}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!editing.isDirty || isBusy} onClick={editing.save}>
              Save to keyboard
            </Button>
          </div>
        ) : (
          <span title={READ_ONLY_EXPLANATION}>
            <Badge tone="warning">Read only</Badge>
          </span>
        )}
      </section>
      {editing.isDirty && !editing.isSaving && (
        <p className="m-0 text-sm text-muted">Unsaved changes. Save or discard them before switching profiles.</p>
      )}
      {editing.notice && <Callout tone={editing.notice.tone} title={editing.notice.text} />}
    </div>
  );
}
