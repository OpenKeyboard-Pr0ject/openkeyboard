import type { KeyboardProfileSummary } from "../../../keyboard/keyboard-profile";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Badge, Message } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { ProfileAvatar } from "../../components/ProfileAvatar";
import type { SectionId } from "../../layout/sections";
import { useProfileEditing } from "../../profile-editing/ProfileEditingContext";
import { ProfileDetails } from "./ProfileDetails";

interface ProfilesPageProps {
  readonly onOpenSection: (section: SectionId) => void;
}

export function ProfilesPage({ onOpenSection }: ProfilesPageProps) {
  const editing = useProfileEditing();
  const { loaded } = editing;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Profiles"
        description="Settings stored on the keyboard, one set per profile."
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={editing.reload}>
            Refresh
          </Button>
        }
      />
      <Card
        title={<>Onboard profiles <Badge>{editing.profiles.length}</Badge></>}
        description="Profiles stored on the keyboard. Pick one to see and edit its settings."
      >
        <ProfileTiles
          profiles={editing.profiles}
          activeSlot={editing.activeSlot}
          selectedSlot={loaded.profile?.slot}
          isLocked={editing.isDirty || editing.isSaving}
          onSelect={editing.selectSlot}
        />
        {editing.isDirty && (
          <p className="mt-3 mb-0 text-sm text-muted">Save or discard your changes before switching profiles.</p>
        )}
      </Card>
      <Card
        title={loaded.profile?.name}
        actions={loaded.profile && (
          <>
            <Button size="small" onClick={() => onOpenSection("actuation")}>Edit actuation point</Button>
            <Button size="small" onClick={() => onOpenSection("rapid-trigger")}>Edit Rapid Trigger</Button>
          </>
        )}
      >
        {loaded.status === "failed" && <Message>{loaded.problem}</Message>}
        {loaded.status === "loading" && !loaded.profile && <Message>Reading profiles…</Message>}
        {loaded.profile && <ProfileDetails profile={loaded.profile} />}
      </Card>
    </div>
  );
}

interface ProfileTilesProps {
  readonly profiles: readonly KeyboardProfileSummary[];
  readonly activeSlot: number;
  readonly selectedSlot: number | undefined;
  readonly isLocked: boolean;
  readonly onSelect: (slot: number) => void;
}

function ProfileTiles({ profiles, activeSlot, selectedSlot, isLocked, onSelect }: ProfileTilesProps) {
  return (
    <div role="tablist" aria-label="Profiles" className="grid gap-3 md:grid-cols-2">
      {profiles.map((profile) => {
        const isSelected = profile.slot === selectedSlot;
        return (
          <button
            key={profile.slot}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={isLocked && !isSelected}
            onClick={() => onSelect(profile.slot)}
            className={[
              "flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isSelected ? "border-accent bg-tint" : "border-transparent bg-sunken hover:bg-subtle",
            ].join(" ")}
          >
            <ProfileAvatar color={profile.color} slot={profile.slot} />
            <span className="min-w-0 flex-1 truncate text-base font-bold text-strong">{profile.name}</span>
            {profile.slot === activeSlot && <Badge tone="accent">Active</Badge>}
          </button>
        );
      })}
    </div>
  );
}
