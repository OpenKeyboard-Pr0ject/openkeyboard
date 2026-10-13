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
import { Badge, ColorSwatch, Message, Notice } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { PillTabs } from "../../components/PillTabs";
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
      <PillTabs
        label="Profiles"
        selected={selectedSlot}
        onSelect={(slot) => void select(slot)}
        tabs={overview.profiles.map((profile) => ({
          value: profile.slot,
          label: <ProfileTabLabel profile={profile} isActive={profile.slot === overview.activeSlot} />,
        }))}
      />
      <Card>
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

interface ProfileTabLabelProps {
  readonly profile: KeyboardProfileSummary;
  readonly isActive: boolean;
}

function ProfileTabLabel({ profile, isActive }: ProfileTabLabelProps) {
  return (
    <>
      <ColorSwatch color={profile.color} />
      {profile.name}
      {isActive && <Badge tone="positive">Active</Badge>}
    </>
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
