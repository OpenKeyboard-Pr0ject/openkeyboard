import { useMemo, useState } from "react";
import {
  BRIGHTNESS_PERCENT_RANGE,
  colorFromHex,
  colorToHex,
  type KeyboardLightingEditor,
  type KeyColor,
  type LightingChange,
  type LightingState,
} from "../../../keyboard/lighting";
import { type LayoutKey, matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { ColorSwatch, Message } from "../../components/feedback";
import { ColorInput, RangeInput } from "../../components/inputs";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import { KeySelectionBar } from "../../profile-editing/KeySelectionBar";

const SELECT_KEYS_HINT = "To change key colors, select one or more keys first";
const FIRST_PICKED_COLOR = "#ff0000";
const MAXIMUM_PROFILE_COLORS = 12;

interface KeyColorLightingFormProps {
  readonly current: LightingState;
  readonly editor: KeyboardLightingEditor;
  readonly physicalLayout: PhysicalLayout | undefined;
  readonly onSaved: (state: LightingState) => void;
  readonly onCancel: () => void;
}

export function KeyColorLightingForm(
  { current, editor, physicalLayout, onSaved, onCancel }: KeyColorLightingFormProps,
) {
  const storedColors = useMemo(() => colorsByKey(current.keyColors ?? []), [current]);
  const layout = useMemo(
    () => physicalLayout ?? keyColorGrid(current.keyColors ?? []),
    [physicalLayout, current],
  );
  const [colors, setColors] = useState<ReadonlyMap<string, string>>(storedColors);
  const [brightnessPercent, setBrightnessPercent] = useState(current.brightnessPercent);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [pickedColor, setPickedColor] = useState(FIRST_PICKED_COLOR);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const profileColors = [...new Set(colors.values())].slice(0, MAXIMUM_PROFILE_COLORS);

  const toggleKey = (id: string) => setSelectedIds((selected) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const applyPickedColor = () => setColors((existing) => {
    const next = new Map(existing);
    for (const id of selectedIds) next.set(id, pickedColor);
    return next;
  });

  const save = async () => {
    const change = lightingChangeFrom(layout.keys, storedColors, colors, current.brightnessPercent, brightnessPercent);
    if (Object.keys(change).length === 0) {
      setStatus("Nothing changed.");
      return;
    }
    setBusy(true);
    setStatus("Writing to the keyboard…");
    try {
      onSaved(await editor.updateLighting(change));
    } catch (error) {
      setStatus(`Not saved: ${describeError(error)}`);
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => event.preventDefault()}>
      <KeyboardCanvas
        layout={layout}
        label="Key colors"
        selectedIds={selectedIds}
        onToggleKey={busy ? undefined : toggleKey}
        appearanceOf={(key) => ({ fill: colors.get(matrixKeyId(key)) })}
      />
      <KeySelectionBar
        title="Key colors"
        selectedCount={selectedIds.size}
        hint={SELECT_KEYS_HINT}
        onSelectAll={() => setSelectedIds(new Set(layout.keys.map(matrixKeyId)))}
        onClear={() => setSelectedIds(new Set())}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Colors">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <ColorInput
                label="Color for the selected keys"
                value={pickedColor}
                disabled={busy}
                onChange={setPickedColor}
              />
              <span className="font-mono text-base text-strong">{pickedColor}</span>
              <Button size="small" disabled={busy || selectedIds.size === 0} onClick={applyPickedColor}>
                Apply to selected keys
              </Button>
            </div>
            <div>
              <SectionLabel>Colors on this profile</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {profileColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Pick ${color}`}
                    onClick={() => setPickedColor(color)}
                    className="flex h-8 w-8 items-center justify-center rounded-md bg-sunken hover:bg-tint"
                  >
                    <ColorSwatch color={color} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Effects">
          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel>Global brightness</SectionLabel>
              <RangeInput
                label="Brightness"
                value={brightnessPercent}
                range={BRIGHTNESS_PERCENT_RANGE}
                valueLabel={`${brightnessPercent} %`}
                disabled={busy}
                onChange={setBrightnessPercent}
              />
            </div>
            <Message>Animated effects cannot be changed from OpenKeyboard yet.</Message>
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-3">
        <Message>Changes are saved to the active profile and read back to confirm.</Message>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void save()}>Save to keyboard</Button>
          <Button disabled={busy} onClick={onCancel}>Cancel</Button>
        </div>
        {status && <Message>{status}</Message>}
      </div>
    </form>
  );
}

function colorsByKey(keyColors: readonly KeyColor[]): ReadonlyMap<string, string> {
  return new Map(keyColors.map((keyColor) => [matrixKeyId(keyColor), colorToHex(keyColor.color)]));
}

function keyColorGrid(keyColors: readonly KeyColor[]): PhysicalLayout {
  return {
    name: "Key matrix",
    keys: keyColors.map((keyColor): LayoutKey => ({
      x: keyColor.matrixColumn,
      y: keyColor.matrixRow,
      width: 1,
      height: 1,
      matrixRow: keyColor.matrixRow,
      matrixColumn: keyColor.matrixColumn,
      label: "",
    })),
  };
}

export function lightingChangeFrom(
  keys: readonly LayoutKey[],
  storedColors: ReadonlyMap<string, string>,
  draftColors: ReadonlyMap<string, string>,
  storedBrightness: number,
  draftBrightness: number,
): LightingChange {
  const keyColors = keys.flatMap((key): KeyColor[] => {
    const id = matrixKeyId(key);
    const draft = draftColors.get(id);
    if (!draft || draft === storedColors.get(id)) return [];
    return [{ matrixRow: key.matrixRow, matrixColumn: key.matrixColumn, color: colorFromHex(draft) }];
  });
  return {
    ...(draftBrightness !== storedBrightness ? { brightnessPercent: draftBrightness } : {}),
    ...(keyColors.length > 0 ? { keyColors } : {}),
  };
}
