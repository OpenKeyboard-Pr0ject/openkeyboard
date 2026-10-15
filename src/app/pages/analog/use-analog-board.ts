import { useMemo } from "react";
import type { KeyboardProfile, SettingRange } from "../../../keyboard/keyboard-profile";
import type { MatrixKey } from "../../../keyboard/matrix-key";
import type { PhysicalLayout } from "../../../keyboard/physical-layout";
import type { AnalogDraft } from "../../profile-editing/analog-draft";
import { type Board, boardFor } from "../../profile-editing/board";
import { type ProfileEditing, useProfileEditing } from "../../profile-editing/ProfileEditingContext";
import { type KeySelection, useKeySelection } from "../../profile-editing/use-key-selection";

export const DEFAULT_ACTUATION_RANGE: SettingRange = { min: 0.1, max: 4, step: 0.05 };
export const DEFAULT_SENSITIVITY_RANGE: SettingRange = { min: 0.1, max: 2.35, step: 0.05 };

export interface AnalogBoard {
  readonly editing: ProfileEditing;
  readonly profile: KeyboardProfile | undefined;
  readonly draft: AnalogDraft | undefined;
  readonly board: Board | undefined;
  readonly boardKeys: readonly MatrixKey[];
  readonly selection: KeySelection;
  readonly canEdit: boolean;
  readonly matrixKeyOf: (id: string) => MatrixKey | undefined;
}

export function useAnalogBoard(physicalLayout: PhysicalLayout | undefined): AnalogBoard {
  const editing = useProfileEditing();
  const profile = editing.loaded.profile;
  const board = useMemo(
    () => (profile ? boardFor(physicalLayout, profile.layout) : undefined),
    [physicalLayout, profile],
  );
  const selection = useKeySelection(board?.keys ?? []);
  const boardKeys = useMemo(() => (board?.keys ?? []).map((key) => key.matrixKey), [board]);
  const keysById = useMemo(() => new Map((board?.keys ?? []).map((key) => [key.id, key.matrixKey])), [board]);
  return {
    editing,
    profile,
    draft: editing.draft,
    board,
    boardKeys,
    selection,
    canEdit: Boolean(editing.editor) && !editing.isSaving && editing.loaded.status === "ready",
    matrixKeyOf: (id) => keysById.get(id),
  };
}
