import { useState } from "react";
import {
  KeyboardDefinitionRequiredError,
  type KeyboardDefinitionLoader,
  type Keymap,
  type KeymapReader,
  type PhysicalKey,
} from "../../../keyboard/keymap";
import { describeError } from "../../../shared/describe-error";
import { formatHex } from "../../../shared/hex";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Message } from "../../components/feedback";
import { RefreshIcon } from "../../components/icons";
import { PageHeader } from "../../components/PageHeader";
import { PillTabs } from "../../components/PillTabs";
import { useLoadable } from "../../hooks/use-loadable";

const FILE_INPUT_CLASSES = [
  "text-sm font-normal text-muted",
  "file:mr-3 file:rounded-lg file:border file:border-line file:bg-raised file:px-3 file:py-1.5 file:text-fg",
].join(" ");

interface KeymapPageProps {
  readonly reader: KeymapReader;
  readonly definitionLoader: KeyboardDefinitionLoader | undefined;
}

export function KeymapPage({ reader, definitionLoader }: KeymapPageProps) {
  const keymap = useLoadable(() => reader.readKeymap());
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [definitionProblem, setDefinitionProblem] = useState<string>();
  const { state } = keymap;
  const useDefinition = (definitionJson: string) => {
    try {
      definitionLoader?.loadDefinition(definitionJson);
      setDefinitionProblem(undefined);
      keymap.reload();
    } catch (error) {
      setDefinitionProblem(describeError(error));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Keymap"
        description="Key assignments on every layer."
        actions={
          <Button size="small" icon={<RefreshIcon width={14} height={14} />} onClick={keymap.reload}>
            Refresh
          </Button>
        }
      />
      {definitionProblem ? (
        <Card>
          <div className="flex flex-col gap-3">
            <Message>{definitionProblem}</Message>
            <DefinitionFilePicker onDefinition={useDefinition} />
          </div>
        </Card>
      ) : (
        <>
          {state.status === "loading" && <Card><Message>Reading keymap…</Message></Card>}
          {state.status === "failed" && (
            <Card>
              <LoadProblem error={state.error} definitionLoader={definitionLoader} onDefinition={useDefinition} />
            </Card>
          )}
          {state.status === "ready" && (
            <LayerView
              keymap={state.value}
              selectedLayer={Math.min(selectedLayer, state.value.layers.length - 1)}
              onSelectLayer={setSelectedLayer}
            />
          )}
        </>
      )}
    </div>
  );
}

interface LoadProblemProps {
  readonly error: unknown;
  readonly definitionLoader: KeyboardDefinitionLoader | undefined;
  readonly onDefinition: (definitionJson: string) => void;
}

function LoadProblem({ error, definitionLoader, onDefinition }: LoadProblemProps) {
  if (error instanceof KeyboardDefinitionRequiredError && definitionLoader) {
    return (
      <div className="flex flex-col gap-3">
        <Message>{error.message}</Message>
        <DefinitionFilePicker onDefinition={onDefinition} />
      </div>
    );
  }
  return <Message>Could not read the keymap: {describeError(error)}</Message>;
}

interface LayerViewProps {
  readonly keymap: Keymap;
  readonly selectedLayer: number;
  readonly onSelectLayer: (layer: number) => void;
}

function LayerView({ keymap, selectedLayer, onSelectLayer }: LayerViewProps) {
  return (
    <>
      <PillTabs
        label="Layers"
        selected={selectedLayer}
        onSelect={onSelectLayer}
        tabs={keymap.layers.map((_, layer) => ({ value: layer, label: `Layer ${layer}` }))}
      />
      <Card title={keymap.name || undefined}>
        <KeyboardDrawing keymap={keymap} layer={selectedLayer} />
      </Card>
    </>
  );
}

function KeyboardDrawing({ keymap, layer }: { readonly keymap: Keymap; readonly layer: number }) {
  const width = Math.max(...keymap.physicalKeys.map((key) => key.x + key.width));
  const height = Math.max(...keymap.physicalKeys.map((key) => key.y + key.height));
  return (
    <div className="@container relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
      {keymap.physicalKeys.map((key, index) => (
        <Keycap key={index} keymap={keymap} layer={layer} physicalKey={key} board={{ width, height }} />
      ))}
    </div>
  );
}

interface KeycapProps {
  readonly keymap: Keymap;
  readonly layer: number;
  readonly physicalKey: PhysicalKey;
  readonly board: { readonly width: number; readonly height: number };
}

function Keycap({ keymap, layer, physicalKey: key, board }: KeycapProps) {
  const assignment = keymap.layers[layer]?.[key.matrixRow]?.[key.matrixColumn];
  const matrix = `matrix ${key.matrixRow},${key.matrixColumn}`;
  const title = assignment ? `${assignment.label || "None"} (${formatHex(assignment.code, 4)}), ${matrix}` : "";
  return (
    <div
      title={title}
      className={[
        "absolute box-border flex items-center justify-center overflow-hidden p-0.5 text-center",
        "rounded-md border-2 border-panel bg-raised text-[clamp(0.5rem,1.6cqw,0.75rem)] leading-tight text-fg",
        "break-words",
      ].join(" ")}
      style={{
        left: `${(key.x / board.width) * 100}%`,
        top: `${(key.y / board.height) * 100}%`,
        width: `${(key.width / board.width) * 100}%`,
        height: `${(key.height / board.height) * 100}%`,
      }}
    >
      {assignment?.label ?? ""}
    </div>
  );
}

function DefinitionFilePicker({ onDefinition }: { readonly onDefinition: (definitionJson: string) => void }) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-fg">
      Load VIA definition (.json)
      <input
        type="file"
        accept="application/json,.json"
        className={FILE_INPUT_CLASSES}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) onDefinition(await file.text());
        }}
      />
    </label>
  );
}
