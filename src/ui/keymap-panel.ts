import {
  KeyboardDefinitionRequiredError,
  type KeyboardDefinitionLoader,
  type Keymap,
  type KeymapReader,
  type PhysicalKey,
} from "../keyboard/keymap";
import { describeError } from "../shared/describe-error";
import { formatHex } from "../shared/hex";
import { actionButton, element, panelMessage } from "./dom";
import type { Panel } from "./panel";

export class KeymapPanel implements Panel {
  readonly element: HTMLElement;
  private readonly layerTabs: HTMLElement;
  private readonly content: HTMLElement;
  private keymap: Keymap | undefined;
  private selectedLayer = 0;
  private disposed = false;

  constructor(
    private readonly reader: KeymapReader,
    private readonly definitionLoader: KeyboardDefinitionLoader | undefined,
  ) {
    this.layerTabs = element("div", "profile-tabs");
    this.content = element("div", "keymap__content");
    const refresh = actionButton("Refresh", "secondary", () => void this.load());
    const heading = element("div", "panel-heading", [element("h3", "panel-heading__title", ["Keymap"]), refresh]);
    this.element = element("section", "panel", [heading, this.layerTabs, this.content]);
    void this.load();
  }

  dispose(): void {
    this.disposed = true;
  }

  private async load(): Promise<void> {
    this.show([panelMessage("Reading keymap…")]);
    try {
      this.keymap = await this.reader.readKeymap();
      this.selectedLayer = Math.min(this.selectedLayer, this.keymap.layers.length - 1);
      this.render();
    } catch (error) {
      this.showLoadProblem(error);
    }
  }

  private showLoadProblem(error: unknown): void {
    if (error instanceof KeyboardDefinitionRequiredError && this.definitionLoader) {
      this.show([panelMessage(error.message), definitionFilePicker((json) => this.useDefinition(json))]);
    } else {
      this.show([panelMessage(`Could not read the keymap: ${describeError(error)}`)]);
    }
  }

  private useDefinition(definitionJson: string): void {
    try {
      this.definitionLoader?.loadDefinition(definitionJson);
      void this.load();
    } catch (error) {
      this.show([panelMessage(describeError(error)), definitionFilePicker((json) => this.useDefinition(json))]);
    }
  }

  private render(): void {
    if (!this.keymap || this.disposed) return;
    const keymap = this.keymap;
    this.layerTabs.replaceChildren(...keymap.layers.map((_, layer) => this.layerTab(layer)));
    this.show([
      ...(keymap.name ? [element("p", "keymap__name", [keymap.name])] : []),
      keyboardDrawing(keymap, this.selectedLayer),
    ]);
  }

  private layerTab(layer: number): HTMLButtonElement {
    const selected = layer === this.selectedLayer ? " profile-tab--selected" : "";
    const tab = element("button", `profile-tab${selected}`, [`Layer ${layer}`]);
    tab.type = "button";
    tab.addEventListener("click", () => {
      this.selectedLayer = layer;
      this.render();
    });
    return tab;
  }

  private show(children: readonly Node[]): void {
    if (!this.disposed) this.content.replaceChildren(...children);
  }
}

function keyboardDrawing(keymap: Keymap, layer: number): HTMLElement {
  const width = Math.max(...keymap.physicalKeys.map((key) => key.x + key.width));
  const height = Math.max(...keymap.physicalKeys.map((key) => key.y + key.height));
  const keycaps = keymap.physicalKeys.map((key) => keycap(keymap, layer, key, { width, height }));
  const drawing = element("div", "keymap", keycaps);
  drawing.style.aspectRatio = `${width} / ${height}`;
  return drawing;
}

function keycap(
  keymap: Keymap,
  layer: number,
  key: PhysicalKey,
  board: { width: number; height: number },
): HTMLElement {
  const assignment = keymap.layers[layer]?.[key.matrixRow]?.[key.matrixColumn];
  const cap = element("div", "keymap__key", [assignment?.label ?? ""]);
  const matrix = `matrix ${key.matrixRow},${key.matrixColumn}`;
  cap.title = assignment ? `${assignment.label || "None"} (${formatHex(assignment.code, 4)}), ${matrix}` : "";
  cap.style.left = `${(key.x / board.width) * 100}%`;
  cap.style.top = `${(key.y / board.height) * 100}%`;
  cap.style.width = `${(key.width / board.width) * 100}%`;
  cap.style.height = `${(key.height / board.height) * 100}%`;
  return cap;
}

function definitionFilePicker(onDefinition: (definitionJson: string) => void): HTMLElement {
  const input = element("input", "keymap__file");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (file) onDefinition(await file.text());
  });
  return element("label", "keymap__file-label", ["Load VIA definition (.json) ", input]);
}

