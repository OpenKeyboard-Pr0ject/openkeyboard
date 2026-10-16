import { useState } from "react";
import type { AnalogKeySource } from "../../../keyboard/analog-keys";
import {
  colorToHex,
  effectColors,
  type KeyboardLightingEditor,
  type KeyboardLightingReader,
  type LightingFrameReader,
  type LightingState,
} from "../../../keyboard/lighting";
import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card, SectionLabel } from "../../components/Card";
import { Callout, ColorSwatch, Message, Notice } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { KeyboardCanvas } from "../../components/KeyboardCanvas";
import { PageHeader } from "../../components/PageHeader";
import { describeEffect } from "../../format/lighting-format";
import { useLoadable } from "../../hooks/use-loadable";
import { KeyColorLightingForm } from "./KeyColorLightingForm";
import { LayeredLightingWorkspace } from "./LayeredLightingWorkspace";
import { LightingForm } from "./LightingForm";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";
const READ_ONLY_EXPLANATION = "OpenKeyboard reads the lighting with the same commands as the vendor's tool. "
  + "Changing it is not supported on this keyboard yet.";
const MAXIMUM_LISTED_COLORS = 16;

export const HIDDEN_KEY_COLORS_TITLE = "An animated effect covers the key colors";
export const HIDDEN_KEY_COLORS_EXPLANATION = "This profile runs an animated base effect, so the keyboard shows "
  + "the effect instead of these key colors. Key colors are still saved, and they appear once the base effect is "
  + "set to Static.";

interface LightingPageProps {
  readonly reader: KeyboardLightingReader;
  readonly editor: KeyboardLightingEditor | undefined;
  readonly physicalLayout: PhysicalLayout | undefined;
  readonly analogKeys?: AnalogKeySource;
  readonly frames?: LightingFrameReader;
}

export function LightingPage({ reader, editor, physicalLayout, analogKeys, frames }: LightingPageProps) {
  const lighting = useLoadable(() => reader.readLighting());
  const [editing, setEditing] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const { state } = lighting;
  const profileName = state.status === "ready" ? state.value.profileName : undefined;
  const catalog = editor?.supportsKeyColors ? editor.layeredEffectCatalog : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="RGB Settings"
        description={profileName
          ? `Lighting of ${profileName}, the active profile.`
          : "Backlight brightness and effect stored on the keyboard."}
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={lighting.reload}>
            Refresh
          </Button>
        }
      />
      {state.status === "loading" && <Card><Message>Reading lighting…</Message></Card>}
      {state.status === "failed" && (
        <Card><Message>Could not read the lighting: {describeError(state.error)}</Message></Card>
      )}
      {state.status === "ready" && editor && catalog && (
        <>
          {state.notice && <Notice>{state.notice}</Notice>}
          <LayeredLightingWorkspace
            key={savedCount}
            current={state.value}
            editor={editor}
            catalog={catalog}
            physicalLayout={physicalLayout}
            analogKeys={analogKeys}
            frames={frames}
            onSaved={(saved) => {
              setSavedCount((count) => count + 1);
              lighting.show(saved, SAVED_NOTICE);
            }}
          />
        </>
      )}
      {state.status === "ready" && !catalog && (
        <>
          {state.notice && <Notice>{state.notice}</Notice>}
          {!(editing && editor?.supportsKeyColors) && (
            <KeyColorsPicture state={state.value} physicalLayout={physicalLayout} />
          )}
          {!editor && <Callout tone="neutral" title="Read only">{READ_ONLY_EXPLANATION}</Callout>}
          {state.value.effectHidesKeyColors && (
            <Callout tone="warning" title={HIDDEN_KEY_COLORS_TITLE}>
              <p className="m-0">{HIDDEN_KEY_COLORS_EXPLANATION}</p>
            </Callout>
          )}
          {editing && editor?.supportsKeyColors && (
            <KeyColorLightingForm
              current={state.value}
              editor={editor}
              physicalLayout={physicalLayout}
              onSaved={(saved) => {
                setEditing(false);
                lighting.show(saved, SAVED_NOTICE);
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          {editing && editor && !editor.supportsKeyColors ? (
            <LightingForm
              current={state.value}
              editor={editor}
              onSaved={(saved) => {
                setEditing(false);
                lighting.show(saved, SAVED_NOTICE);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : !editing && (
            <LightingOverview state={state.value} onEdit={editor ? () => setEditing(true) : undefined} />
          )}
        </>
      )}
    </div>
  );
}

interface KeyColorsPictureProps {
  readonly state: LightingState;
  readonly physicalLayout: PhysicalLayout | undefined;
}

function KeyColorsPicture({ state, physicalLayout }: KeyColorsPictureProps) {
  if (!physicalLayout || !state.keyColors) return null;
  const colorsByKey = new Map(state.keyColors.map((keyColor) => [matrixKeyId(keyColor), colorToHex(keyColor.color)]));
  return (
    <KeyboardCanvas
      layout={physicalLayout}
      label="Key colors"
      appearanceOf={(key) => ({ fill: colorsByKey.get(matrixKeyId(key)) })}
    />
  );
}

interface LightingOverviewProps {
  readonly state: LightingState;
  readonly onEdit: (() => void) | undefined;
}

function LightingOverview({ state, onEdit }: LightingOverviewProps) {
  const colors = listedColors(state);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Colors">
        {colors.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {colors.map((color) => (
              <span key={color} className="flex items-center gap-2 rounded-md bg-sunken px-2 py-1 text-sm text-fg">
                <ColorSwatch color={color} title={color} />
                {color}
              </span>
            ))}
          </div>
        ) : <Message>This effect uses no fixed colors.</Message>}
      </Card>
      <Card
        title="Effects"
        actions={onEdit && <Button variant="primary" size="small" onClick={onEdit}>Change lighting</Button>}
      >
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>Global brightness</SectionLabel>
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-60 max-w-full overflow-hidden rounded-full bg-sunken">
                <span className="block h-full bg-accent" style={{ width: `${state.brightnessPercent}%` }} />
              </span>
              <span className="text-base font-semibold tabular-nums text-strong">{state.brightnessPercent} %</span>
            </div>
          </div>
          <div>
            <SectionLabel>Effect</SectionLabel>
            <p className="m-0 text-base text-strong">{describeEffect(state.effect)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function listedColors(state: LightingState): string[] {
  const colors = state.keyColors
    ? state.keyColors.map((keyColor) => colorToHex(keyColor.color))
    : effectColors(state.effect).map(colorToHex);
  return [...new Set(colors)].slice(0, MAXIMUM_LISTED_COLORS);
}
