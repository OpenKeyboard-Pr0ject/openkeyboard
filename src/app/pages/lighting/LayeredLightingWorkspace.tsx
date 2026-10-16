import { useEffect, useMemo, useState } from "react";
import type { KeyboardLightingEditor, LightingState } from "../../../keyboard/lighting";
import type { KeyColorLayer, LayeredEffectCatalog } from "../../../keyboard/lighting-effects";
import {
  type LayoutKey,
  matrixKeyId,
  matrixPositionFromKeyId,
  type PhysicalLayout,
} from "../../../keyboard/physical-layout";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ColorPicker } from "../../components/ColorPicker";
import { Badge, Message } from "../../components/feedback";
import { RedoIcon, UndoIcon } from "../../components/icons";
import { Toggle } from "../../components/inputs";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import { useHistory } from "../../hooks/use-history";
import { useRecentColors } from "../../hooks/use-recent-colors";
import { useStoredFlag } from "../../hooks/use-stored-flag";
import { KeySelectionBar } from "../../profile-editing/KeySelectionBar";
import { EffectsPanel } from "./EffectsPanel";
import {
  BASE_LAYER_SELECTION,
  draftFromState,
  hasChanges,
  type LayerSelection,
  lightingChangeFromDraft,
  withKeyColor,
} from "./lighting-draft";
import { useLivePreview } from "./use-live-preview";

const FIRST_PICKED_COLOR = "#ff0000";
const SELECT_KEYS_HINT = "Select keys, then apply a color to them";
const UNDO_KEY = "z";
const REDO_KEY = "y";
const LIVE_PREVIEW_STORAGE_KEY = "openkeyboard.lighting-live-preview";
const LIVE_PREVIEW_EXPLANATION = "Changes show on the keyboard right away. Save to Keyboard keeps them. "
  + "Discard changes, or leaving this page, puts the saved lighting back.";
const SAVE_ONLY_EXPLANATION = "Changes are saved to the active profile and read back to confirm.";

interface LayeredLightingWorkspaceProps {
  readonly current: LightingState;
  readonly editor: KeyboardLightingEditor;
  readonly catalog: LayeredEffectCatalog;
  readonly physicalLayout: PhysicalLayout | undefined;
  readonly onSaved: (state: LightingState) => void;
}

export function LayeredLightingWorkspace(
  { current, editor, catalog, physicalLayout, onSaved }: LayeredLightingWorkspaceProps,
) {
  const stored = useMemo(() => draftFromState(current, catalog), [current, catalog]);
  const history = useHistory(() => stored);
  const draft = history.present;
  const layout = useMemo(() => physicalLayout ?? matrixGrid([...stored.keyColors.keys()]), [physicalLayout, stored]);
  const [selection, setSelection] = useState<LayerSelection>(BASE_LAYER_SELECTION);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pickedColor, setPickedColor] = useState(FIRST_PICKED_COLOR);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const recentColors = useRecentColors();
  const dirty = hasChanges(stored, draft);
  const change = useMemo(() => lightingChangeFromDraft(stored, draft), [stored, draft]);
  const [livePreviewEnabled, setLivePreviewEnabled] = useStoredFlag(LIVE_PREVIEW_STORAGE_KEY, true);
  const preview = useLivePreview(editor, change, livePreviewEnabled);
  const canDiscard = dirty || preview.pending;

  useUndoShortcuts(history.undo, history.redo, busy);

  const toggleKey = (id: string) => setSelectedIds((selected) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const applyPickedColor = () => {
    history.update((present) => withKeyColor(present, selectedIds, pickedColor));
    recentColors.remember(pickedColor);
  };

  const discard = async () => {
    history.reset(stored);
    setSelection(BASE_LAYER_SELECTION);
    if (!preview.pending) {
      setStatus(undefined);
      return;
    }
    setBusy(true);
    setStatus("Putting the saved lighting back on the keyboard…");
    try {
      await preview.discard();
      setStatus(undefined);
    } catch (error) {
      setStatus(`Could not put the saved lighting back: ${describeError(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (Object.keys(change).length === 0) {
      setStatus("Nothing changed.");
      return;
    }
    setBusy(true);
    setStatus("Writing to the keyboard…");
    try {
      onSaved(await preview.save(change));
    } catch (error) {
      setStatus(`Not saved: ${describeError(error)}`);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {preview.supported && (
          <span className="mr-auto flex items-center gap-2 text-sm text-fg">
            <Toggle
              label="Live preview"
              checked={livePreviewEnabled}
              disabled={busy}
              onChange={setLivePreviewEnabled}
            />
            Live preview
          </span>
        )}
        {preview.pending && dirty && <Badge tone="accent">Previewing</Badge>}
        {dirty && <Badge tone="warning">Unsaved changes</Badge>}
        <Button
          variant="ghost"
          size="small"
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          disabled={busy || !history.canUndo}
          icon={<UndoIcon width={16} height={16} />}
          onClick={history.undo}
        />
        <Button
          variant="ghost"
          size="small"
          aria-label="Redo"
          title="Redo (Ctrl+Y)"
          disabled={busy || !history.canRedo}
          icon={<RedoIcon width={16} height={16} />}
          onClick={history.redo}
        />
        <Button size="small" disabled={busy || !canDiscard} onClick={() => void discard()}>Discard changes</Button>
        <Button variant="primary" size="small" disabled={busy || !dirty} onClick={() => void save()}>
          Save to Keyboard
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)]">
        <KeyColorLayerList layers={catalog.keyColorLayers} />
        <KeyboardCanvas
          layout={layout}
          label="Key colors"
          selectedIds={selectedIds}
          onToggleKey={busy ? undefined : toggleKey}
          appearanceOf={(key) => ({ fill: draft.keyColors.get(matrixKeyId(key)) })}
        />
      </div>
      <KeySelectionBar
        title="Key colors"
        selectedCount={selectedIds.size}
        hint={SELECT_KEYS_HINT}
        onSelectAll={() => setSelectedIds(new Set(layout.keys.map(matrixKeyId)))}
        onClear={() => setSelectedIds(new Set())}
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Colors">
          <div className="flex flex-col gap-4">
            <ColorPicker
              color={pickedColor}
              onChange={setPickedColor}
              recentColors={recentColors.colors}
              disabled={busy}
            />
            <Button
              variant="primary"
              disabled={busy || selectedIds.size === 0}
              onClick={applyPickedColor}
            >
              Apply to selected keys
            </Button>
          </div>
        </Card>
        <Card title="Effects" className="md:col-span-3">
          <EffectsPanel
            catalog={catalog}
            draft={draft}
            selection={selection}
            disabled={busy}
            onSelect={setSelection}
            onEdit={history.update}
          />
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        <Message>
          {preview.supported && livePreviewEnabled ? LIVE_PREVIEW_EXPLANATION : SAVE_ONLY_EXPLANATION}
        </Message>
        {preview.error && <Message>{preview.error}</Message>}
        {status && <Message>{status}</Message>}
      </div>
    </div>
  );
}

function KeyColorLayerList({ layers }: { readonly layers: readonly KeyColorLayer[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm font-bold tracking-wide text-fg uppercase">Layers</p>
      {layers.map((layer, index) => (
        <button
          key={layer.name}
          type="button"
          aria-pressed={index === 0}
          disabled={!layer.editable}
          title={layer.explanation}
          className={[
            "h-9 rounded-md border px-3 text-left text-sm font-semibold transition",
            index === 0 ? "border-accent bg-tint text-strong" : "border-transparent bg-sunken text-fg",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        >
          {layer.name}
        </button>
      ))}
      {layers.filter((layer) => !layer.editable && layer.explanation).map((layer) => (
        <p key={layer.name} className="m-0 text-xs text-muted">{layer.name}: {layer.explanation}</p>
      ))}
    </div>
  );
}

function useUndoShortcuts(undo: () => void, redo: () => void, disabled: boolean): void {
  useEffect(() => {
    if (disabled) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isEditingText(event.target)) return;
      const key = event.key.toLowerCase();
      const wantsRedo = key === REDO_KEY || (key === UNDO_KEY && event.shiftKey);
      if (wantsRedo) redo();
      else if (key === UNDO_KEY) undo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, disabled]);
}

function isEditingText(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}

function matrixGrid(keyIds: readonly string[]): PhysicalLayout {
  return {
    name: "Key matrix",
    keys: keyIds.map((keyId): LayoutKey => {
      const position = matrixPositionFromKeyId(keyId);
      return { ...position, x: position.matrixColumn, y: position.matrixRow, width: 1, height: 1, label: "" };
    }),
  };
}
