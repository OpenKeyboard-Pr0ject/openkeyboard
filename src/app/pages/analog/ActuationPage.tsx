import type { AnalogKeySource } from "../../../keyboard/analog-keys";
import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { Message } from "../../components/feedback";
import { RangeInput } from "../../components/inputs";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import {
  coversWholeBoard,
  effectiveActuation,
  hasOwnActuation,
  withActuation,
  withProfileActuation,
} from "../../profile-editing/analog-draft";
import { roundToStep } from "../../profile-editing/board";
import { KeySelectionBar } from "../../profile-editing/KeySelectionBar";
import { ProfileBar } from "../../profile-editing/ProfileBar";
import { VisualFeedbackCard } from "../../profile-editing/VisualFeedbackCard";
import { DEFAULT_ACTUATION_RANGE, useAnalogBoard } from "./use-analog-board";

const SELECT_KEYS_HINT = "To adjust the actuation point, select one or more keys first";

interface ActuationPageProps {
  readonly physicalLayout: PhysicalLayout | undefined;
  readonly analogKeys: AnalogKeySource | undefined;
}

export function ActuationPage({ physicalLayout, analogKeys }: ActuationPageProps) {
  const { editing, draft, board, boardKeys, selection, canEdit, matrixKeyOf } = useAnalogBoard(physicalLayout);
  const range = editing.editor?.actuationRange ?? DEFAULT_ACTUATION_RANGE;
  const selected = selection.selectedKeys;
  const sliderValue = draft
    ? (selected.length > 0 ? effectiveActuation(draft, selected[0]) : draft.actuationMillimeters)
    : range.min;
  const isWholeBoard = coversWholeBoard(selected, boardKeys);
  const canResetSelection = Boolean(draft) && !isWholeBoard && selected.some((key) => hasOwnActuation(draft!, key));

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
            label="Keys and their actuation points"
            selectedIds={selection.selectedIds}
            onToggleKey={selection.toggle}
            appearanceOf={(layoutKey) => {
              const key = matrixKeyOf(matrixKeyId(layoutKey));
              if (!key) return {};
              return {
                annotation: effectiveActuation(draft, key).toFixed(2),
                isHighlighted: hasOwnActuation(draft, key),
              };
            }}
          />
          <KeySelectionBar
            title="Actuation Point"
            selectedCount={selected.length}
            hint={SELECT_KEYS_HINT}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Card
              title="Set Actuation Point"
              description="How far a key must be pressed before it registers. Lower values react sooner."
            >
              <div className="flex flex-col gap-4">
                <div>
                  <SectionLabel>Changing actuation point for</SectionLabel>
                  <p className="m-0 text-base font-bold text-accent-ink">
                    {isWholeBoard ? "Every key" : `${selected.length} ${selected.length === 1 ? "key" : "keys"}`}
                  </p>
                </div>
                <RangeInput
                  label="Actuation point"
                  value={sliderValue}
                  range={range}
                  valueLabel={`${sliderValue.toFixed(2)} mm`}
                  disabled={!canEdit || selected.length === 0}
                  onChange={(value) => {
                    const millimeters = roundToStep(value, range);
                    editing.changeDraft((current) => withActuation(current, selected, millimeters, boardKeys));
                  }}
                />
                {canResetSelection && canEdit && (
                  <div>
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => editing.changeDraft((current) => withProfileActuation(current, selected))}
                    >
                      Use the profile value ({draft.actuationMillimeters.toFixed(2)} mm)
                    </Button>
                  </div>
                )}
                <Message>
                  Profile value: {draft.actuationMillimeters.toFixed(2)} mm. Highlighted keys have their own value.
                </Message>
              </div>
            </Card>
            {analogKeys ? (
              <VisualFeedbackCard
                source={analogKeys}
                fullTravelMillimeters={range.max}
                actuationOf={(key) => effectiveActuation(draft, key)}
              />
            ) : (
              <Card title="Visual Feedback">
                <Message>This keyboard does not report how far its keys are pressed.</Message>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
