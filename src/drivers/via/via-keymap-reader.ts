import {
  KeyboardDefinitionRequiredError,
  type KeyAssignment,
  type KeyboardDefinitionLoader,
  type Keymap,
  type KeymapReader,
} from "../../keyboard/keymap";
import {
  parseKeyboardDefinition,
  visiblePhysicalKeys,
  type KeyboardDefinition,
} from "../../protocol/via/keyboard-definition";
import { qmkKeycodeLabel, type QmkKeycodeGeneration } from "../../protocol/via/qmk-keycodes";
import {
  decodeKeycodes,
  readUint32BigEndian,
  readUint32LittleEndian,
  ViaCommandNotSupportedError,
} from "../../protocol/via/via-codec";
import type { ViaCommandChannel } from "../../protocol/via/via-command-channel";
import {
  VIA_KEYMAP_CHUNK_BYTES,
  VIA_REPORT_LENGTH,
  ViaCommand,
  ViaKeyboardValue,
  VialCommand,
} from "../../protocol/via/via-constants";
import { decompressXzText } from "../../protocol/via/xz-text";

const BYTES_PER_KEYCODE = 2;
const KEYMAP_BUFFER_HEADER_BYTES = 3;
const LAYOUT_OPTIONS_OFFSET = 1;
const NO_LAYOUT_OPTIONS = 0;

export interface ViaKeymapReaderOptions {
  readonly channel: ViaCommandChannel;
  readonly keycodeGeneration: QmkKeycodeGeneration;
  readonly hasEmbeddedDefinition: boolean;
}

export class ViaKeymapReader implements KeymapReader, KeyboardDefinitionLoader {
  private definition: KeyboardDefinition | undefined;

  constructor(private readonly options: ViaKeymapReaderOptions) {}

  loadDefinition(definitionJson: string): void {
    this.definition = parseKeyboardDefinition(definitionJson);
  }

  async readKeymap(): Promise<Keymap> {
    const definition = await this.resolveDefinition();
    const layerCount = (await this.options.channel.request(ViaCommand.getLayerCount))[0];
    const keysPerLayer = definition.matrixRows * definition.matrixColumns;
    const keycodes = decodeKeycodes(await this.readKeymapBuffer(layerCount * keysPerLayer * BYTES_PER_KEYCODE));
    return {
      name: definition.name,
      physicalKeys: visiblePhysicalKeys(definition, await this.readLayoutOptions()),
      layers: Array.from({ length: layerCount }, (_, layer) =>
        this.toLayer(keycodes.slice(layer * keysPerLayer, (layer + 1) * keysPerLayer), definition.matrixColumns)),
    };
  }

  private async resolveDefinition(): Promise<KeyboardDefinition> {
    if (!this.definition && this.options.hasEmbeddedDefinition) {
      this.definition = parseKeyboardDefinition(await this.readEmbeddedDefinition());
    }
    if (!this.definition) throw new KeyboardDefinitionRequiredError();
    return this.definition;
  }

  private async readEmbeddedDefinition(): Promise<string> {
    const sizeReply = await this.options.channel.requestVial(VialCommand.getDefinitionSize);
    const compressedSize = readUint32LittleEndian(sizeReply, 0);
    const compressed = new Uint8Array(compressedSize);
    for (let page = 0; page * VIA_REPORT_LENGTH < compressedSize; page += 1) {
      const pageBytes = await this.options.channel.requestVial(VialCommand.getDefinitionPage, [page & 0xff, page >> 8]);
      const offset = page * VIA_REPORT_LENGTH;
      compressed.set(pageBytes.subarray(0, Math.min(VIA_REPORT_LENGTH, compressedSize - offset)), offset);
    }
    return decompressXzText(compressed);
  }

  private async readKeymapBuffer(totalBytes: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(totalBytes);
    for (let offset = 0; offset < totalBytes; offset += VIA_KEYMAP_CHUNK_BYTES) {
      const size = Math.min(VIA_KEYMAP_CHUNK_BYTES, totalBytes - offset);
      const reply = await this.options.channel.request(ViaCommand.getKeymapBuffer, [offset >> 8, offset & 0xff, size]);
      buffer.set(reply.subarray(KEYMAP_BUFFER_HEADER_BYTES, KEYMAP_BUFFER_HEADER_BYTES + size), offset);
    }
    return buffer;
  }

  private async readLayoutOptions(): Promise<number> {
    try {
      const reply = await this.options.channel.request(ViaCommand.getKeyboardValue, [ViaKeyboardValue.layoutOptions]);
      return readUint32BigEndian(reply, LAYOUT_OPTIONS_OFFSET);
    } catch (error) {
      if (error instanceof ViaCommandNotSupportedError) return NO_LAYOUT_OPTIONS;
      throw error;
    }
  }

  private toLayer(keycodes: readonly number[], columns: number): KeyAssignment[][] {
    const rows: KeyAssignment[][] = [];
    for (let start = 0; start < keycodes.length; start += columns) {
      rows.push(keycodes.slice(start, start + columns).map((code) => ({
        code,
        label: qmkKeycodeLabel(code, this.options.keycodeGeneration),
      })));
    }
    return rows;
  }
}
