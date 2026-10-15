import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { Card, SectionLabel } from "../../components/Card";
import { Callout, Message } from "../../components/feedback";
import { RangeInput, Toggle } from "../../components/inputs";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import {
  keyRapidTriggerState,
  withContinuousRapidTrigger,
  withRapidTriggerEnabled,
  withRapidTriggerSensitivity,
} from "../../profile-editing/analog-draft";
import { roundToStep } from "../../profile-editing/board";
import { KeySelectionBar } from "../../profile-editing/KeySelectionBar";
import { ProfileBar } from "../../profile-editing/ProfileBar";
import { DEFAULT_SENSITIVITY_RANGE, useAnalogBoard } from "./use-analog-board";

const SELECT_KEYS_HINT = "To adjust Rapid Trigger, select one or more keys first";
const RAPID_TRIGGER_DESCRIPTION =
  "After the actuation point, a key activates and resets as soon as it moves down or up by the sensitivity.";
const CONTINUOUS_DESCRIPTION =
  "When on, Rapid Trigger stays active until the key is fully released. When off, it ends at the actuation point.";

export function RapidTriggerPage({ physicalLayout }: { readonly physicalLayout: PhysicalLayout | undefined }) {
  const { editing, draft, board, boardKeys, selection, canEdit, matrixKeyOf } = useAnalogBoard(physicalLayout);
  const range = editing.editor?.rapidTriggerSensitivityRange ?? DEFAULT_SENSITIVITY_RANGE;
  const selected = selection.selectedKeys;
  const selectedStates = draft ? selected.map((key) => keyRapidTriggerState(draft, key)) : [];
  const enabledOnSelection = selectedStates.length > 0 && selectedStates.every((state) => state.enabled);
  const enabledKeyCount = draft ? boardKeys.filter((key) => keyRapidTriggerState(draft, key).enabled).length : 0;
  const sensitivity = selectedStates[0]?.sensitivityMillimeters
    ?? draft?.rapidTrigger.sensitivityMillimeters
    ?? range.min;

  return (
    <div className="flex flex-col gap-6">
      <ProfileBar />
      {editing.loaded.status === "failed" && <Card><Message>{editing.loaded.problem}</Message></Card>}
      {!draft || !board ? (
        editing.loaded.status !== "failed" && <Card><Message>Reading the profile…</Message></Card>
      ) : (
        <>
          <KeyboardCanvas
            layout={board.layout}
            label="Keys and their Rapid Trigger sensitivity"
            selectedIds={selection.selectedIds}
            onToggleKey={selection.toggle}
            appearanceOf={(layoutKey) => {
              const key = matrixKeyOf(matrixKeyId(layoutKey));
              if (!key) return {};
              const state = keyRapidTriggerState(draft, key);
              return state.enabled
                ? { annotation: state.sensitivityMillimeters.toFixed(2), isHighlighted: true }
                : {};
            }}
          />
          <KeySelectionBar
            title="Rapid Trigger"
            selectedCount={selected.length}
            hint={SELECT_KEYS_HINT}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              title="Enable Rapid Trigger"
              description={RAPID_TRIGGER_DESCRIPTION}
              actions={
                <Toggle
                  label="Rapid Trigger on the selected keys"
                  checked={enabledOnSelection}
                  disabled={!canEdit || selected.length === 0}
                  onChange={(enabled) => editing.changeDraft(
                    (current) => withRapidTriggerEnabled(current, selected, enabled, boardKeys),
                  )}
                />
              }
            >
              <SectionLabel>
                Enabled on <span className="text-accent-ink">{enabledKeyCount}</span> keys
              </SectionLabel>
            </Card>
            <Card title="Rapid Trigger Sensitivity" description="How far a key must move to activate or reset again.">
              <div className="flex flex-col gap-2">
                <SectionLabel>Sensitivity</SectionLabel>
                <RangeInput
                  label="Rapid Trigger sensitivity"
                  value={sensitivity}
                  range={range}
                  valueLabel={`${sensitivity.toFixed(2)} mm`}
                  disabled={!canEdit || selected.length === 0 || !enabledOnSelection}
                  onChange={(value) => {
                    const millimeters = roundToStep(value, range);
                    editing.changeDraft(
                      (current) => withRapidTriggerSensitivity(current, selected, millimeters, boardKeys),
                    );
                  }}
                />
                <div className="flex w-72 max-w-full justify-between text-xs font-bold text-muted uppercase">
                  <span>High</span>
                  <span className="mr-16">Low</span>
                </div>
                {selected.length > 0 && !enabledOnSelection && (
                  <Message>Enable Rapid Trigger on the selected keys to change their sensitivity.</Message>
                )}
              </div>
            </Card>
            <Card
              title="Continuous Rapid Trigger"
              description={CONTINUOUS_DESCRIPTION}
              actions={
                <Toggle
                  label="Continuous Rapid Trigger"
                  checked={draft.rapidTrigger.continuous}
                  disabled={!canEdit}
                  onChange={(continuous) => editing.changeDraft(
                    (current) => withContinuousRapidTrigger(current, continuous),
                  )}
                />
              }
            >
              <Callout tone="accent" title="Applies to the whole profile">
                <p className="m-0">Turn it on to repeat a key quickly without thinking about the actuation point.</p>
              </Callout>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
