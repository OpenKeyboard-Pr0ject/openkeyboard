import { useState } from "react";
import {
  colorToHex,
  effectColors,
  type KeyboardLightingEditor,
  type KeyboardLightingReader,
  type LightingState,
} from "../../../keyboard/lighting";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { DetailList } from "../../components/DetailList";
import { ColorSwatch, Message, Notice } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { describeEffect } from "../../format/lighting-format";
import { useLoadable } from "../../hooks/use-loadable";
import { LightingForm } from "./LightingForm";

const SAVED_NOTICE = "Saved to the keyboard and confirmed by reading it back.";

interface LightingPageProps {
  readonly reader: KeyboardLightingReader;
  readonly editor: KeyboardLightingEditor | undefined;
}

export function LightingPage({ reader, editor }: LightingPageProps) {
  const lighting = useLoadable(() => reader.readLighting());
  const [editing, setEditing] = useState(false);
  const { state } = lighting;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lighting"
        description="Backlight brightness and effect stored on the keyboard."
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={lighting.reload}>
            Refresh
          </Button>
        }
      />
      <Card>
        {state.status === "loading" && <Message>Reading lighting…</Message>}
        {state.status === "failed" && <Message>Could not read the lighting: {describeError(state.error)}</Message>}
        {state.status === "ready" && editing && editor && (
          <LightingForm
            current={state.value}
            editor={editor}
            onSaved={(saved) => {
              setEditing(false);
              lighting.show(saved, SAVED_NOTICE);
            }}
            onCancel={() => setEditing(false)}
          />
        )}
        {state.status === "ready" && !(editing && editor) && (
          <div className="flex flex-col gap-5">
            {state.notice && <Notice>{state.notice}</Notice>}
            <LightingDetails state={state.value} />
            {editor && (
              <div>
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Change lighting
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function LightingDetails({ state }: { readonly state: LightingState }) {
  const colors = effectColors(state.effect).map(colorToHex);
  return (
    <DetailList
      details={[
        { label: "Brightness", value: `${state.brightnessPercent} %` },
        { label: "Effect", value: describeEffect(state.effect) },
        ...(colors.length > 0
          ? [{
            label: "Colors",
            value: (
              <span className="flex flex-wrap items-center gap-1.5">
                {colors.map((color, index) => <ColorSwatch key={`${color}-${index}`} color={color} title={color} />)}
              </span>
            ),
          }]
          : []),
      ]}
    />
  );
}
