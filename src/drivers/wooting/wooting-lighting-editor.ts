import {
  assertValidBrightness,
  assertValidKeyColors,
  type KeyboardLightingEditor,
  type LightingChange,
  type LightingPreview,
  type LightingState,
  UnsupportedLightingEffectError,
  type WritableLightingEffectKind,
} from "../../keyboard/lighting";
import { assertValidLayeredEffects, type LayeredEffectCatalog } from "../../keyboard/lighting-effects";
import { encodeWootingReport } from "../../protocol/wooting/wooting-codec";
import type { WootingCommandChannel } from "../../protocol/wooting/wooting-command-channel";
import {
  WOOTING_PREVIEW_STORAGE,
  WootingCommand,
  WootingReportType,
  type WootingReportTypeId,
} from "../../protocol/wooting/wooting-constants";
import { decodeCurrentProfileIndex } from "../../protocol/wooting/wooting-profile-codec";
import {
  brightnessRawFromPercent,
  rgbCoreBrightnessRaw,
  rgbRowsAreComplete,
  rgbRowValues,
  withRgbCoreBrightness,
  withRgbRowColors,
} from "../../protocol/wooting/wooting-rgb-codec";
import { decodeRgbEffects, withRgbEffects } from "../../protocol/wooting/wooting-rgb-effects-codec";
import { WOOTING_EFFECT_CATALOG } from "./wooting-effect-catalog";
import type { WootingLightingReader } from "./wooting-lighting-reader";
import type { StoredRgbParts, WootingRgbPreviewState } from "./wooting-rgb-preview-state";

const UPPER_ROWS_START = 0;
const LOWER_ROWS_START = 3;
const ROWS_PER_PART = 3;
const SINGLE_EFFECTS_NOT_USED = "Wooting keyboards combine a base effect with effect layers instead.";

interface RgbPart {
  readonly key: keyof StoredRgbParts;
  readonly name: string;
  readonly reportType: WootingReportTypeId;
  readonly readCommand: (typeof WootingCommand)[keyof typeof WootingCommand];
  readonly normalize: (payload: Uint8Array) => string;
}

interface RowPart extends RgbPart {
  readonly key: "upperRows" | "lowerRows";
  readonly firstRow: number;
}

const CORE_PART: RgbPart = {
  key: "core",
  name: "brightness and effects",
  reportType: WootingReportType.rgbCore,
  readCommand: WootingCommand.getRgbCore,
  normalize: (payload) => JSON.stringify([rgbCoreBrightnessRaw(payload), decodeRgbEffects(payload)]),
};

const UPPER_ROWS_PART: RowPart = {
  key: "upperRows",
  name: "key colors of rows 1 to 3",
  reportType: WootingReportType.rgbUpperRows,
  readCommand: WootingCommand.getRgbUpperRows,
  normalize: (payload) => JSON.stringify(rgbRowValues(payload)),
  firstRow: UPPER_ROWS_START,
};

const LOWER_ROWS_PART: RowPart = {
  key: "lowerRows",
  name: "key colors of rows 4 to 6",
  reportType: WootingReportType.rgbLowerRows,
  readCommand: WootingCommand.getRgbLowerRows,
  normalize: (payload) => JSON.stringify(rgbRowValues(payload)),
  firstRow: LOWER_ROWS_START,
};

const WRITE_ORDER: readonly RgbPart[] = [CORE_PART, UPPER_ROWS_PART, LOWER_ROWS_PART];
const ROW_PARTS: readonly RowPart[] = [UPPER_ROWS_PART, LOWER_ROWS_PART];

export class UnexpectedRgbRowsError extends Error {
  constructor(partName: string) {
    super(`The keyboard returned the ${partName} in an unexpected shape, so nothing was written.`);
    this.name = "UnexpectedRgbRowsError";
  }
}

export class LightingWriteNotVerifiedError extends Error {
  constructor(partNames: readonly string[]) {
    super(`The keyboard did not keep the new ${partNames.join(" and ")}.`);
    this.name = "LightingWriteNotVerifiedError";
  }
}

export class ActiveProfileChangedDuringLightingWriteError extends Error {
  constructor(before: number, after: number) {
    super(`The active profile moved from slot ${before + 1} to slot ${after + 1} while the lighting was written.`);
    this.name = "ActiveProfileChangedDuringLightingWriteError";
  }
}

export class LightingPreviewEndedError extends Error {
  constructor() {
    super("This lighting preview was already saved or discarded. Start a new one.");
    this.name = "LightingPreviewEndedError";
  }
}

export class WootingLightingEditor implements KeyboardLightingEditor {
  readonly supportedEffects: readonly WritableLightingEffectKind[] = [];
  readonly maximumEffectColors = 0;
  readonly supportsKeyColors = true;
  readonly layeredEffectCatalog = WOOTING_EFFECT_CATALOG;
  private readonly previewState: WootingRgbPreviewState;

  constructor(
    private readonly commands: WootingCommandChannel,
    private readonly reader: WootingLightingReader,
  ) {
    this.previewState = reader.previewState;
  }

  async updateLighting(change: LightingChange): Promise<LightingState> {
    assertValidLightingChange(change, this.layeredEffectCatalog);
    const slot = await this.readActiveSlot();
    this.previewState.forgetUnlessFor(slot);
    const stored = await this.storedParts(slot);
    const planned = plannedParts(stored, change);
    const changesSomething = WRITE_ORDER.some((part) => !samePart(part, planned, stored));
    if (!changesSomething && !this.previewState.isPending(slot)) return this.reader.readLighting();
    return this.commit(slot, planned);
  }

  async beginPreview(): Promise<LightingPreview> {
    const slot = await this.readActiveSlot();
    this.previewState.forgetUnlessFor(slot);
    const stored = await this.storedParts(slot);
    return new WootingLightingPreview(this, slot, stored);
  }

  async showPreview(
    slot: number,
    stored: StoredRgbParts,
    shown: StoredRgbParts,
    change: LightingChange,
  ): Promise<StoredRgbParts> {
    assertValidLightingChange(change, this.layeredEffectCatalog);
    const planned = plannedParts(stored, change);
    const changedParts = WRITE_ORDER.filter((part) => !sameBytes(planned[part.key], shown[part.key]));
    if (changedParts.length === 0) return shown;
    this.previewState.markPending(slot, stored);
    for (const part of changedParts) await this.writePreview(part, planned[part.key]);
    return planned;
  }

  async savePreview(slot: number, stored: StoredRgbParts, change: LightingChange): Promise<LightingState> {
    assertValidLightingChange(change, this.layeredEffectCatalog);
    await this.requireActiveSlot(slot);
    return this.commit(slot, plannedParts(stored, change));
  }

  async discardPreview(slot: number, stored: StoredRgbParts): Promise<void> {
    if (!this.previewState.isPending(slot)) return;
    const activeSlot = await this.readActiveSlot();
    this.previewState.forgetUnlessFor(activeSlot);
    if (activeSlot !== slot) return;
    await this.commit(slot, stored);
  }

  private async commit(slot: number, planned: StoredRgbParts): Promise<LightingState> {
    for (const part of WRITE_ORDER) await this.writePreview(part, planned[part.key]);
    await this.commands.request(WootingCommand.saveRgbProfile, [slot]);
    this.previewState.clear();
    await this.verifyStored(slot, planned);
    await this.requireActiveSlot(slot);
    return this.reader.readLighting();
  }

  private writePreview(part: RgbPart, payload: Uint8Array): Promise<void> {
    return this.commands.writeReport(encodeWootingReport(part.reportType, WOOTING_PREVIEW_STORAGE, payload));
  }

  private async storedParts(slot: number): Promise<StoredRgbParts> {
    return this.previewState.storedWhilePending(slot) ?? this.readAllParts(slot);
  }

  private async readAllParts(slot: number): Promise<StoredRgbParts> {
    const stored: StoredRgbParts = {
      core: await this.readPart(CORE_PART, slot),
      upperRows: await this.readPart(UPPER_ROWS_PART, slot),
      lowerRows: await this.readPart(LOWER_ROWS_PART, slot),
    };
    for (const part of ROW_PARTS) {
      if (!rgbRowsAreComplete(stored[part.key])) throw new UnexpectedRgbRowsError(part.name);
    }
    return stored;
  }

  private async verifyStored(slot: number, planned: StoredRgbParts): Promise<void> {
    const unconfirmed: string[] = [];
    for (const part of WRITE_ORDER) {
      const stored = await this.readPart(part, slot);
      if (part.normalize(stored) !== part.normalize(planned[part.key])) unconfirmed.push(part.name);
    }
    if (unconfirmed.length > 0) throw new LightingWriteNotVerifiedError(unconfirmed);
  }

  private async requireActiveSlot(slot: number): Promise<void> {
    const activeSlot = await this.readActiveSlot();
    if (activeSlot !== slot) throw new ActiveProfileChangedDuringLightingWriteError(slot, activeSlot);
  }

  private async readActiveSlot(): Promise<number> {
    return decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
  }

  private readPart(part: RgbPart, slot: number): Promise<Uint8Array> {
    return this.commands.request(part.readCommand, [slot]);
  }
}

class WootingLightingPreview implements LightingPreview {
  private shown: StoredRgbParts;
  private ended = false;

  constructor(
    private readonly editor: WootingLightingEditor,
    private readonly slot: number,
    private readonly stored: StoredRgbParts,
  ) {
    this.shown = stored;
  }

  async show(change: LightingChange): Promise<void> {
    this.requireOpen();
    this.shown = await this.editor.showPreview(this.slot, this.stored, this.shown, change);
  }

  async save(change: LightingChange): Promise<LightingState> {
    this.requireOpen();
    const saved = await this.editor.savePreview(this.slot, this.stored, change);
    this.ended = true;
    return saved;
  }

  async discard(): Promise<void> {
    this.requireOpen();
    await this.editor.discardPreview(this.slot, this.stored);
    this.ended = true;
  }

  private requireOpen(): void {
    if (this.ended) throw new LightingPreviewEndedError();
  }
}

function assertValidLightingChange(change: LightingChange, catalog: LayeredEffectCatalog): void {
  if (change.effect) throw new UnsupportedLightingEffectError(change.effect, SINGLE_EFFECTS_NOT_USED);
  if (change.brightnessPercent !== undefined) assertValidBrightness(change.brightnessPercent);
  if (change.keyColors) assertValidKeyColors(change.keyColors);
  if (change.layeredEffects) assertValidLayeredEffects(catalog, change.layeredEffects);
}

function plannedParts(stored: StoredRgbParts, change: LightingChange): StoredRgbParts {
  let core = stored.core;
  if (change.brightnessPercent !== undefined) {
    core = withRgbCoreBrightness(core, brightnessRawFromPercent(change.brightnessPercent));
  }
  if (change.layeredEffects) core = withRgbEffects(core, change.layeredEffects);
  return {
    core,
    upperRows: plannedRows(stored, UPPER_ROWS_PART, change),
    lowerRows: plannedRows(stored, LOWER_ROWS_PART, change),
  };
}

function plannedRows(stored: StoredRgbParts, part: RowPart, change: LightingChange): Uint8Array {
  const rowColors = (change.keyColors ?? []).filter(
    (keyColor) => keyColor.matrixRow >= part.firstRow && keyColor.matrixRow < part.firstRow + ROWS_PER_PART,
  );
  if (rowColors.length === 0) return stored[part.key];
  return withRgbRowColors(stored[part.key], part.firstRow, rowColors);
}

function samePart(part: RgbPart, first: StoredRgbParts, second: StoredRgbParts): boolean {
  return part.normalize(first[part.key]) === part.normalize(second[part.key]);
}

function sameBytes(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}
