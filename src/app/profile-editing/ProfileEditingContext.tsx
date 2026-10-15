import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardProfile,
  KeyboardProfileEditor,
  KeyboardProfileReader,
  KeyboardProfileSummary,
} from "../../keyboard/keyboard-profile";
import { describeError } from "../../shared/describe-error";
import type { Tone } from "../components/feedback";
import { type AnalogDraft, analogSettingsChange, hasAnalogChanges, initialAnalogDraft } from "./analog-draft";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";
const WRITING_NOTICE = "Writing to the keyboard…";

export interface EditingNotice {
  readonly tone: Tone;
  readonly text: string;
}

type LoadedProfile =
  | { readonly status: "loading"; readonly profile?: KeyboardProfile }
  | { readonly status: "ready"; readonly profile: KeyboardProfile }
  | { readonly status: "failed"; readonly problem: string; readonly profile?: KeyboardProfile };

export interface ProfileEditing {
  readonly loaded: LoadedProfile;
  readonly profiles: readonly KeyboardProfileSummary[];
  readonly activeSlot: number;
  readonly draft: AnalogDraft | undefined;
  readonly editor: KeyboardProfileEditor | undefined;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly notice: EditingNotice | undefined;
  selectSlot(slot: number): void;
  reload(): void;
  changeDraft(change: (draft: AnalogDraft) => AnalogDraft): void;
  discard(): void;
  save(): void;
}

const ProfileEditingContext = createContext<ProfileEditing | undefined>(undefined);

interface ProfileEditingProviderProps {
  readonly reader: KeyboardProfileReader;
  readonly editor: KeyboardProfileEditor | undefined;
  readonly children: ReactNode;
}

export function ProfileEditingProvider({ reader, editor, children }: ProfileEditingProviderProps) {
  const [profiles, setProfiles] = useState<readonly KeyboardProfileSummary[]>([]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [loaded, setLoaded] = useState<LoadedProfile>({ status: "loading" });
  const [draft, setDraft] = useState<AnalogDraft>();
  const [isSaving, setSaving] = useState(false);
  const [notice, setNotice] = useState<EditingNotice>();
  const latestRequest = useRef(0);
  const selectedSlot = useRef<number | undefined>(undefined);

  const show = useCallback((profile: KeyboardProfile) => {
    selectedSlot.current = profile.slot;
    setLoaded({ status: "ready", profile });
    setDraft(initialAnalogDraft(profile));
  }, []);

  const readSlot = useCallback(async (slot: number, request: number) => {
    try {
      const profile = await reader.readProfile(slot);
      if (request === latestRequest.current) show(profile);
    } catch (error) {
      const problem = `Could not read profile ${slot + 1}: ${describeError(error)}`;
      if (request === latestRequest.current) setLoaded({ status: "failed", problem });
    }
  }, [reader, show]);

  const selectSlot = useCallback((slot: number) => {
    latestRequest.current += 1;
    setNotice(undefined);
    setLoaded((current) => ({ status: "loading", profile: current.profile }));
    void readSlot(slot, latestRequest.current);
  }, [readSlot]);

  const reload = useCallback(async () => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    setNotice(undefined);
    setLoaded((current) => ({ status: "loading", profile: current.profile }));
    try {
      const active = await reader.readActiveSlot();
      const list = await reader.listProfiles();
      if (request !== latestRequest.current) return;
      setActiveSlot(active);
      setProfiles(list);
      await readSlot(selectedSlot.current ?? active, request);
    } catch (error) {
      const problem = `Could not read the profiles: ${describeError(error)}`;
      if (request === latestRequest.current) setLoaded({ status: "failed", problem });
    }
  }, [reader, readSlot]);

  useEffect(() => {
    void reload();
    return () => {
      latestRequest.current += 1;
    };
  }, [reload]);

  const profile = loaded.profile;
  const isDirty = Boolean(profile && draft && hasAnalogChanges(profile, draft));

  const save = useCallback(async () => {
    if (!editor || !profile || !draft) return;
    const change = analogSettingsChange(profile, draft);
    if (Object.keys(change).length === 0) return;
    setSaving(true);
    setNotice({ tone: "neutral", text: WRITING_NOTICE });
    try {
      show(await editor.updateProfile(profile.slot, change));
      setNotice({ tone: "positive", text: SAVED_NOTICE });
    } catch (error) {
      setNotice({ tone: "negative", text: `Not saved: ${describeError(error)}` });
    } finally {
      setSaving(false);
    }
  }, [editor, profile, draft, show]);

  const value = useMemo<ProfileEditing>(() => ({
    loaded,
    profiles,
    activeSlot,
    draft,
    editor,
    isDirty,
    isSaving,
    notice,
    selectSlot,
    reload: () => void reload(),
    changeDraft: (change) => {
      setNotice(undefined);
      setDraft((current) => (current ? change(current) : current));
    },
    discard: () => {
      setNotice(undefined);
      if (profile) setDraft(initialAnalogDraft(profile));
    },
    save: () => void save(),
  }), [loaded, profiles, activeSlot, draft, editor, isDirty, isSaving, notice, selectSlot, reload, profile, save]);

  return <ProfileEditingContext.Provider value={value}>{children}</ProfileEditingContext.Provider>;
}

export function useProfileEditing(): ProfileEditing {
  const editing = useContext(ProfileEditingContext);
  if (!editing) throw new Error("Profile editing is only available inside ProfileEditingProvider.");
  return editing;
}
