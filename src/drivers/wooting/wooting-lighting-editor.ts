import {
  assertValidBrightness,
  assertValidKeyColors,
  type KeyboardLightingEditor,
  type LightingChange,
  type LightingState,
  UnsupportedLightingEffectError,
  type WritableLightingEffectKind,
} from "../../keyboard/lighting";
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
import type { WootingLightingReader } from "./wooting-lighting-reader";

const UPPER_ROWS_START = 0;
const LOWER_ROWS_START = 3;
const EFFECTS_NOT_DECODED = "Wooting lighting effects are not decoded yet.";

interface StoredRgbPart {
  readonly name: string;
  readonly reportType: WootingReportTypeId;
  readonly readCommand: (typeof WootingCommand)[keyof typeof WootingCommand];
  readonly normalize: (payload: Uint8Array) => string;
}

const CORE_PART: StoredRgbPart = {
  name: "brightness",
  reportType: WootingReportType.rgbCore,
  readCommand: WootingCommand.getRgbCore,
  normalize: (payload) => String(rgbCoreBrightnessRaw(payload)),
};

const UPPER_ROWS_PART: StoredRgbPart = {
  name: "key colors of rows 1 to 3",
  reportType: WootingReportType.rgbUpperRows,
  readCommand: WootingCommand.getRgbUpperRows,
  normalize: (payload) => JSON.stringify(rgbRowValues(payload)),
};

const LOWER_ROWS_PART: StoredRgbPart = {
  name: "key colors of rows 4 to 6",
  reportType: WootingReportType.rgbLowerRows,
  readCommand: WootingCommand.getRgbLowerRows,
  normalize: (payload) => JSON.stringify(rgbRowValues(payload)),
};

const WRITE_ORDER: readonly StoredRgbPart[] = [CORE_PART, UPPER_ROWS_PART, LOWER_ROWS_PART];
const ROWS_PER_PART = 3;
const ROW_PARTS: ReadonlyArray<readonly [StoredRgbPart, number]> = [
  [UPPER_ROWS_PART, UPPER_ROWS_START],
  [LOWER_ROWS_PART, LOWER_ROWS_START],
];

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

export class WootingLightingEditor implements KeyboardLightingEditor {
  readonly supportedEffects: readonly WritableLightingEffectKind[] = [];
  readonly maximumEffectColors = 0;
  readonly supportsKeyColors = true;

  constructor(
    private readonly commands: WootingCommandChannel,
    private readonly reader: WootingLightingReader,
  ) {}

  async updateLighting(change: LightingChange): Promise<LightingState> {
    if (change.effect) throw new UnsupportedLightingEffectError(change.effect, EFFECTS_NOT_DECODED);
    if (change.brightnessPercent !== undefined) assertValidBrightness(change.brightnessPercent);
    if (change.keyColors) assertValidKeyColors(change.keyColors);
    const slot = await this.readActiveSlot();
    const stored = await this.readAllParts(slot);
    const planned = plannedPayloads(stored, change);
    const changesSomething = WRITE_ORDER.some(
      (part) => part.normalize(planned.get(part)!) !== part.normalize(stored.get(part)!),
    );
    if (!changesSomething) return this.reader.readLighting();
    for (const part of WRITE_ORDER) {
      const report = encodeWootingReport(part.reportType, WOOTING_PREVIEW_STORAGE, planned.get(part)!);
      await this.commands.writeReport(report);
    }
    await this.commands.request(WootingCommand.saveRgbProfile, [slot]);
    await this.verifyStored(slot, planned);
    const slotAfter = await this.readActiveSlot();
    if (slotAfter !== slot) throw new ActiveProfileChangedDuringLightingWriteError(slot, slotAfter);
    return this.reader.readLighting();
  }

  private async readAllParts(slot: number): Promise<Map<StoredRgbPart, Uint8Array>> {
    const stored = new Map<StoredRgbPart, Uint8Array>();
    for (const part of WRITE_ORDER) stored.set(part, await this.readPart(part, slot));
    for (const [part] of ROW_PARTS) {
      if (!rgbRowsAreComplete(stored.get(part)!)) throw new UnexpectedRgbRowsError(part.name);
    }
    return stored;
  }

  private async verifyStored(slot: number, planned: ReadonlyMap<StoredRgbPart, Uint8Array>): Promise<void> {
    const unconfirmed: string[] = [];
    for (const [part, payload] of planned) {
      const stored = await this.readPart(part, slot);
      if (part.normalize(stored) !== part.normalize(payload)) unconfirmed.push(part.name);
    }
    if (unconfirmed.length > 0) throw new LightingWriteNotVerifiedError(unconfirmed);
  }

  private async readActiveSlot(): Promise<number> {
    return decodeCurrentProfileIndex(await this.commands.request(WootingCommand.getCurrentProfileIndex));
  }

  private readPart(part: StoredRgbPart, slot: number): Promise<Uint8Array> {
    return this.commands.request(part.readCommand, [slot]);
  }
}

function plannedPayloads(
  stored: ReadonlyMap<StoredRgbPart, Uint8Array>,
  change: LightingChange,
): Map<StoredRgbPart, Uint8Array> {
  const planned = new Map(stored);
  if (change.brightnessPercent !== undefined) {
    const brightnessRaw = brightnessRawFromPercent(change.brightnessPercent);
    planned.set(CORE_PART, withRgbCoreBrightness(stored.get(CORE_PART)!, brightnessRaw));
  }
  const keyColors = change.keyColors ?? [];
  for (const [part, firstRow] of ROW_PARTS) {
    const rowColors = keyColors.filter(
      (keyColor) => keyColor.matrixRow >= firstRow && keyColor.matrixRow < firstRow + ROWS_PER_PART,
    );
    if (rowColors.length > 0) planned.set(part, withRgbRowColors(stored.get(part)!, firstRow, rowColors));
  }
  return planned;
}
