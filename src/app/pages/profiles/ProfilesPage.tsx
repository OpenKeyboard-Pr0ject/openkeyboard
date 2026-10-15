import { useCallback, useEffect, useRef, useState } from "react";
import type {
  KeyboardProfile,
  KeyboardProfileEditor,
  KeyboardProfileReader,
  KeyboardProfileSummary,
} from "../../../keyboard/keyboard-profile";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Badge, Message, Notice } from "../../components/feedback";
import { KeyboardIcon, RefreshIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { ProfileDetails } from "./ProfileDetails";
import { ProfileSettingsForm } from "./ProfileSettingsForm";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";

interface ProfileOverview {
  readonly profiles: readonly KeyboardProfileSummary[];
  readonly activeSlot: number;
}

type ProfileView =
  | { readonly kind: "message"; readonly text: string }
  | { readonly kind: "profile"; readonly profile: KeyboardProfile; readonly notice?: string }
  | { readonly kind: "editing"; readonly profile: KeyboardProfile };

interface ProfilesPageProps {
  readonly reader: KeyboardProfileReader;
  readonly editor: KeyboardProfileEditor | undefined;
}

export function ProfilesPage({ reader, editor }: ProfilesPageProps) {
  const [overview, setOverview] = useState<ProfileOverview>({ profiles: [], activeSlot: 0 });
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const [view, setView] = useState<ProfileView>({ kind: "message", text: "Reading profiles…" });
  const latestRequest = useRef(0);
  const selectedSlotRef = useRef<number | undefined>(undefined);
  selectedSlotRef.current = selectedSlot;

  const select = useCallback(async (slot: number) => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    setSelectedSlot(slot);
    try {
      const profile = await reader.readProfile(slot);
      if (request === latestRequest.current) setView({ kind: "profile", profile });
    } catch (error) {
      const text = `Could not read profile ${slot + 1}: ${describeError(error)}`;
      if (request === latestRequest.current) setView({ kind: "message", text });
    }
  }, [reader]);

  const load = useCallback(async () => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    setView({ kind: "message", text: "Reading profiles…" });
    try {
      const activeSlot = await reader.readActiveSlot();
      const profiles = await reader.listProfiles();
      if (request !== latestRequest.current) return;
      setOverview({ profiles, activeSlot });
      await select(selectedSlotRef.current ?? activeSlot);
    } catch (error) {
      if (request === latestRequest.current) {
        setView({ kind: "message", text: `Could not read the profiles: ${describeError(error)}` });
      }
    }
  }, [reader, select]);

  useEffect(() => {
    void load();
    return () => {
      latestRequest.current += 1;
    };
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profiles"
        description="Settings stored on the keyboard, one set per profile."
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      <Card
        title={<>Onboard profiles <Badge>{overview.profiles.length}</Badge></>}
        description="Profiles stored on the keyboard. Pick one to see its settings."
      >
        <ProfileTiles
          profiles={overview.profiles}
          activeSlot={overview.activeSlot}
          selectedSlot={selectedSlot}
          onSelect={(slot) => void select(slot)}
        />
      </Card>
      <Card title={view.kind === "message" ? undefined : view.profile.name}>
        <ProfileViewContent
          view={view}
          editor={editor}
          activeSlot={overview.activeSlot}
          onEdit={(profile) => setView({ kind: "editing", profile })}
          onSaved={(profile) => setView({ kind: "profile", profile, notice: SAVED_NOTICE })}
          onCancel={(profile) => setView({ kind: "profile", profile })}
        />
      </Card>
    </div>
  );
}

interface ProfileTilesProps {
  readonly profiles: readonly KeyboardProfileSummary[];
  readonly activeSlot: number;
  readonly selectedSlot: number | undefined;
  readonly onSelect: (slot: number) => void;
}

function ProfileTiles({ profiles, activeSlot, selectedSlot, onSelect }: ProfileTilesProps) {
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
            onClick={() => onSelect(profile.slot)}
            className={[
              "flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
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

function ProfileAvatar({ color, slot }: { readonly color: string; readonly slot: number }) {
  return (
    <span className="relative shrink-0">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-panel text-strong"
        style={{ boxShadow: `0 0 0 2px ${color}` }}
      >
        <KeyboardIcon width={20} height={20} />
      </span>
      <span className="absolute -top-1.5 -left-1.5 rounded bg-tint-strong px-1 text-xs font-bold text-strong">
        {slot + 1}
      </span>
    </span>
  );
}

interface ProfileViewContentProps {
  readonly view: ProfileView;
  readonly editor: KeyboardProfileEditor | undefined;
  readonly activeSlot: number;
  readonly onEdit: (profile: KeyboardProfile) => void;
  readonly onSaved: (profile: KeyboardProfile) => void;
  readonly onCancel: (profile: KeyboardProfile) => void;
}

function ProfileViewContent({ view, editor, activeSlot, onEdit, onSaved, onCancel }: ProfileViewContentProps) {
  if (view.kind === "message") return <Message>{view.text}</Message>;
  if (view.kind === "editing" && editor) {
    return (
      <ProfileSettingsForm
        profile={view.profile}
        isActiveProfile={view.profile.slot === activeSlot}
        editor={editor}
        onSaved={onSaved}
        onCancel={() => onCancel(view.profile)}
      />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {view.kind === "profile" && view.notice && <Notice>{view.notice}</Notice>}
      <ProfileDetails profile={view.profile} />
      {editor && (
        <div>
          <Button variant="primary" onClick={() => onEdit(view.profile)}>
            Edit settings
          </Button>
        </div>
      )}
    </div>
  );
}
