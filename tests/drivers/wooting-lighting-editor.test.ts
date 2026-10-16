import { describe, expect, it } from "vitest";
import {
  ActiveProfileChangedDuringLightingWriteError,
  LightingPreviewEndedError,
  LightingWriteNotVerifiedError,
  UnexpectedRgbRowsError,
  WootingLightingEditor,
} from "../../src/drivers/wooting/wooting-lighting-editor";
import { WootingLightingReader } from "../../src/drivers/wooting/wooting-lighting-reader";
import { InvalidKeyColorError, UnsupportedLightingEffectError } from "../../src/keyboard/lighting";
import { InvalidLayeredEffectsError, type LayeredEffects } from "../../src/keyboard/lighting-effects";
import { WootingCommandChannel } from "../../src/protocol/wooting/wooting-command-channel";
import { WootingCommand } from "../../src/protocol/wooting/wooting-constants";
import { rgbRowValues } from "../../src/protocol/wooting/wooting-rgb-codec";
import { decodeRgbEffects, wootingEffectDefaults } from "../../src/protocol/wooting/wooting-rgb-effects-codec";
import { FakeHidDevice } from "../fakes/fake-hid-device";
import {
  emptyPayload,
  payloadOf,
  replyCarrying,
  rgbRowsReadDuringPreviewPayload,
  tenzRgbRowsPayload,
  typingProfileMetadataPayload,
  typingRgbCorePayload,
  wootilitySaveTypingRgbCommand,
  wootilityTypingBrightness230CoreReport,
} from "../fakes/wooting-80he-captures";

const TYPING_SLOT = 1;
const HEADER_BYTES = 6;
const PREVIEW_STORAGE = 0x00;
const WOOTILITY_CYCLE_WITH_RT_DISPLAY_CORE = payloadOf("0a0b08ff0110ffff0318ffff0322"
  + "0f0a062204080010300a055a03088c01");

const CYCLE_WITH_RT_DISPLAY: LayeredEffects = {
  base: { effectId: "cycle", values: wootingEffectDefaults("cycle") },
  effectLayers: [{ effectId: "rt-display", values: wootingEffectDefaults("rt-display") }],
};

type RgbPartName = "core" | "upper" | "lower";

const PART_BY_REPORT_TYPE: ReadonlyMap<number, RgbPartName> = new Map([
  [0x16, "core"],
  [0x0e, "upper"],
  [0x0f, "lower"],
]);

const PART_BY_READ_COMMAND: ReadonlyMap<number, RgbPartName> = new Map([
  [WootingCommand.getRgbCore, "core"],
  [WootingCommand.getRgbUpperRows, "upper"],
  [WootingCommand.getRgbLowerRows, "lower"],
]);

class FakeRgbKeyboard {
  readonly flash = new Map<RgbPartName, Uint8Array>([
    ["core", typingRgbCorePayload],
    ["upper", tenzRgbRowsPayload],
    ["lower", tenzRgbRowsPayload],
  ]);
  readonly preview = new Map<RgbPartName, Uint8Array>(this.flash);
  readonly events: string[] = [];
  readonly device: FakeHidDevice;
  activeSlot = TYPING_SLOT;
  private previewPending = false;

  constructor(private readonly keepsSaves = true, private readonly garblesLowerRowsOnSave = false) {
    this.device = new FakeHidDevice({
      respond: (_reportId, data) => this.answer(data),
      receiveOutputReport: (_reportId, data) => {
        this.events.push(`write ${data[2].toString(16)}`);
        this.previewPending = true;
        this.preview.set(...this.previewOf(data));
      },
    });
  }

  private answer(command: Uint8Array): Uint8Array {
    const [, , id, slot] = command;
    if (id === WootingCommand.getCurrentProfileIndex) return replyCarrying(id, payloadOf(`0${this.activeSlot}00`));
    if (id === WootingCommand.getProfileMetadata) return replyCarrying(id, typingProfileMetadataPayload);
    if (id === WootingCommand.saveRgbProfile) {
      this.events.push(`save ${slot}`);
      this.previewPending = false;
      if (slot === TYPING_SLOT && this.keepsSaves) {
        this.preview.forEach((payload, part) => this.flash.set(part, payload));
      }
      if (this.garblesLowerRowsOnSave) this.flash.set("lower", rgbRowsReadDuringPreviewPayload);
    }
    const part = PART_BY_READ_COMMAND.get(id);
    if (part) this.events.push(`read ${part}`);
    if (part && part !== "core" && this.previewPending) return replyCarrying(id, rgbRowsReadDuringPreviewPayload);
    return replyCarrying(id, part ? this.flash.get(part)! : emptyPayload);
  }

  private previewOf(report: Uint8Array): [RgbPartName, Uint8Array] {
    const part = PART_BY_REPORT_TYPE.get(report[2]);
    if (!part || report[3] !== PREVIEW_STORAGE) throw new Error(`Unexpected report ${report[2]} ${report[3]}`);
    const length = report[4] | (report[5] << 8);
    return [part, report.slice(HEADER_BYTES, HEADER_BYTES + length)];
  }
}

function editorFor(keyboard: FakeRgbKeyboard): WootingLightingEditor {
  return editorAndReaderFor(keyboard).editor;
}

function editorAndReaderFor(keyboard: FakeRgbKeyboard) {
  const commands = new WootingCommandChannel(keyboard.device.asHidDevice());
  const reader = new WootingLightingReader(commands);
  return { editor: new WootingLightingEditor(commands, reader), reader };
}

function sentReportTypes(keyboard: FakeRgbKeyboard): number[] {
  return keyboard.device.sentOutputReports.map(({ data }) => data[2]);
}

function sentSaves(keyboard: FakeRgbKeyboard): number {
  return keyboard.device.sentFeatureReports.filter(({ data }) => data[2] === WootingCommand.saveRgbProfile).length;
}

const BLUE_ON_ROW_FOUR = [{ matrixRow: 4, matrixColumn: 2, color: { red: 0, green: 0, blue: 255 } }];

function sentReportPrefix(keyboard: FakeRgbKeyboard, index: number, length: number): number[] {
  return [...keyboard.device.sentOutputReports[index].data.subarray(0, length)];
}

describe("WootingLightingEditor", () => {
  it("sets the brightness with the same bytes Wootility sent", async () => {
    const keyboard = new FakeRgbKeyboard();

    const lighting = await editorFor(keyboard).updateLighting({ brightnessPercent: 90 });

    expect(sentReportPrefix(keyboard, 0, wootilityTypingBrightness230CoreReport.length))
      .toEqual([...wootilityTypingBrightness230CoreReport]);
    const saveCommand = keyboard.device.sentFeatureReports.find(
      ({ data }) => data[2] === WootingCommand.saveRgbProfile,
    );
    expect(saveCommand?.data).toEqual(wootilitySaveTypingRgbCommand);
    expect(lighting.brightnessPercent).toBe(90);
  });

  it("previews the core and both color halves before saving them to the active slot", async () => {
    const keyboard = new FakeRgbKeyboard();

    await editorFor(keyboard).updateLighting({ brightnessPercent: 90 });

    expect(keyboard.device.sentOutputReports.map(({ reportId, data }) => [reportId, data.length, data[2], data[3]]))
      .toEqual([
        [1, 32, 0x16, 0x00],
        [3, 254, 0x0e, 0x00],
        [3, 254, 0x0f, 0x00],
      ]);
    expect(sentReportPrefix(keyboard, 1, HEADER_BYTES + tenzRgbRowsPayload.length))
      .toEqual([0xd1, 0xda, 0x0e, 0x00, 0xc9, 0x00, ...tenzRgbRowsPayload]);
  });

  it("changes one key color and keeps every other key", async () => {
    const keyboard = new FakeRgbKeyboard();

    await editorFor(keyboard).updateLighting({
      keyColors: [{ matrixRow: 2, matrixColumn: 1, color: { red: 0, green: 0, blue: 255 } }],
    });

    const before = rgbRowValues(tenzRgbRowsPayload);
    const after = rgbRowValues(keyboard.flash.get("upper")!);
    expect(after[2][1]).toBe(0x001f);
    expect(after.map((row, rowIndex) => row.filter((_, column) => !(rowIndex === 2 && column === 1))))
      .toEqual(before.map((row, rowIndex) => row.filter((_, column) => !(rowIndex === 2 && column === 1))));
    expect([...keyboard.flash.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
  });

  it("reads every part before the first preview and writes from those bytes", async () => {
    const keyboard = new FakeRgbKeyboard();

    await editorFor(keyboard).updateLighting({ brightnessPercent: 90 });

    expect(keyboard.events.slice(0, 6)).toEqual([
      "read core",
      "read upper",
      "read lower",
      "write 16",
      "write e",
      "write f",
    ]);
    expect([...keyboard.flash.get("upper")!]).toEqual([...tenzRgbRowsPayload]);
    expect([...keyboard.flash.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
  });

  it("refuses to write when the stored rows have an unexpected shape", async () => {
    const keyboard = new FakeRgbKeyboard();
    const twoRows = tenzRgbRowsPayload.subarray(0, (tenzRgbRowsPayload.length / 3) * 2);
    keyboard.flash.set("upper", twoRows);

    await expect(editorFor(keyboard).updateLighting({ brightnessPercent: 90 }))
      .rejects.toBeInstanceOf(UnexpectedRgbRowsError);
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("writes nothing when the change matches what is stored", async () => {
    const keyboard = new FakeRgbKeyboard();

    await editorFor(keyboard).updateLighting({ brightnessPercent: 100 });

    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("writes a base effect and an effect layer with the bytes Wootility previewed", async () => {
    const keyboard = new FakeRgbKeyboard();

    const lighting = await editorFor(keyboard).updateLighting({ layeredEffects: CYCLE_WITH_RT_DISPLAY });

    const header = [0xd1, 0xda, 0x16, PREVIEW_STORAGE, WOOTILITY_CYCLE_WITH_RT_DISPLAY_CORE.length, 0x00];
    expect(sentReportPrefix(keyboard, 0, HEADER_BYTES + WOOTILITY_CYCLE_WITH_RT_DISPLAY_CORE.length))
      .toEqual([...header, ...WOOTILITY_CYCLE_WITH_RT_DISPLAY_CORE]);
    expect(decodeRgbEffects(keyboard.flash.get("core")!)).toEqual(CYCLE_WITH_RT_DISPLAY);
    expect(lighting.layeredEffects).toEqual(CYCLE_WITH_RT_DISPLAY);
  });

  it("changes brightness and effects in one core report", async () => {
    const keyboard = new FakeRgbKeyboard();

    await editorFor(keyboard).updateLighting({ brightnessPercent: 90, layeredEffects: CYCLE_WITH_RT_DISPLAY });

    const core = keyboard.flash.get("core")!;
    expect(core[3]).toBe(0xe6);
    expect(decodeRgbEffects(core)).toEqual(CYCLE_WITH_RT_DISPLAY);
  });

  it("refuses effect values outside the ranges Wootility allows", async () => {
    const keyboard = new FakeRgbKeyboard();
    const tooFast = { base: { effectId: "wave", values: { look: 0, speed: 61, direction: 0 } }, effectLayers: [] };

    await expect(editorFor(keyboard).updateLighting({ layeredEffects: tooFast }))
      .rejects.toBeInstanceOf(InvalidLayeredEffectsError);
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("refuses more effect layers than the keyboard holds", async () => {
    const keyboard = new FakeRgbKeyboard();
    const rtDisplay = CYCLE_WITH_RT_DISPLAY.effectLayers[0];
    const fourLayers = { ...CYCLE_WITH_RT_DISPLAY, effectLayers: [rtDisplay, rtDisplay, rtDisplay, rtDisplay] };

    await expect(editorFor(keyboard).updateLighting({ layeredEffects: fourLayers }))
      .rejects.toBeInstanceOf(InvalidLayeredEffectsError);
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("refuses single lighting effects, which Wooting keyboards do not use", async () => {
    const keyboard = new FakeRgbKeyboard();

    await expect(editorFor(keyboard).updateLighting({ effect: { kind: "spectrum" } }))
      .rejects.toBeInstanceOf(UnsupportedLightingEffectError);
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("refuses a key color with channels outside 0 to 255", async () => {
    const keyboard = new FakeRgbKeyboard();
    const keyColors = [{ matrixRow: 0, matrixColumn: 0, color: { red: 256, green: 0, blue: 0 } }];

    await expect(editorFor(keyboard).updateLighting({ keyColors })).rejects.toBeInstanceOf(InvalidKeyColorError);
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });

  it("checks every written part, so rows the keyboard garbles while saving are reported", async () => {
    const keyboard = new FakeRgbKeyboard(true, true);

    await expect(editorFor(keyboard).updateLighting({ brightnessPercent: 90 }))
      .rejects.toThrow("key colors of rows 4 to 6");
  });

  it("reports a save that the keyboard did not keep", async () => {
    const keyboard = new FakeRgbKeyboard(false);

    await expect(editorFor(keyboard).updateLighting({ brightnessPercent: 90 }))
      .rejects.toBeInstanceOf(LightingWriteNotVerifiedError);
  });
});

describe("WootingLightingEditor live preview", () => {
  it("shows a change on the keyboard without saving it", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.show({ brightnessPercent: 90 });

    expect(keyboard.device.sentOutputReports.map(({ data }) => [data[2], data[3]])).toEqual([[0x16, PREVIEW_STORAGE]]);
    expect(sentSaves(keyboard)).toBe(0);
    expect(keyboard.preview.get("core")![3]).toBe(0xe6);
    expect(keyboard.flash.get("core")![3]).toBe(0xff);
  });

  it("reads every part before the first preview and none while previewing", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.show({ brightnessPercent: 90 });
    await preview.show({ brightnessPercent: 80 });

    expect(keyboard.events).toEqual(["read core", "read upper", "read lower", "write 16", "write 16"]);
  });

  it("sends only the parts that differ from what the keyboard shows", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.show({ brightnessPercent: 90 });
    await preview.show({ brightnessPercent: 90 });
    await preview.show({ brightnessPercent: 90, keyColors: BLUE_ON_ROW_FOUR });

    expect(sentReportTypes(keyboard)).toEqual([0x16, 0x0f]);
  });

  it("shows the stored lighting again when the change is undone", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.show({ brightnessPercent: 90 });
    await preview.show({});

    expect([...keyboard.preview.get("core")!]).toEqual([...typingRgbCorePayload]);
  });

  it("shows effects with the bytes Wootility previewed", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.show({ layeredEffects: CYCLE_WITH_RT_DISPLAY });

    expect([...keyboard.preview.get("core")!]).toEqual([...WOOTILITY_CYCLE_WITH_RT_DISPLAY_CORE]);
  });

  it("reports the saved lighting while a preview is pending, from the bytes read before it", async () => {
    const keyboard = new FakeRgbKeyboard();
    const { editor, reader } = editorAndReaderFor(keyboard);
    const preview = await editor.beginPreview();
    await preview.show({ keyColors: BLUE_ON_ROW_FOUR });

    const lighting = await reader.readLighting();

    expect(lighting.keyColors?.find((key) => key.matrixRow === 4 && key.matrixColumn === 2)?.color)
      .toEqual({ red: 255, green: 0, blue: 0 });
    expect(keyboard.events.filter((event) => event.startsWith("read"))).toEqual([
      "read core",
      "read upper",
      "read lower",
    ]);
  });

  it("saves the preview with the save sequence of Wootility and checks it", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();
    await preview.show({ keyColors: BLUE_ON_ROW_FOUR });

    const saved = await preview.save({ keyColors: BLUE_ON_ROW_FOUR });

    expect(keyboard.events.slice(4, 8)).toEqual(["write 16", "write e", "write f", "save 1"]);
    expect(rgbRowValues(keyboard.flash.get("lower")!)[1][2]).toBe(0x001f);
    expect([...keyboard.flash.get("upper")!]).toEqual([...tenzRgbRowsPayload]);
    expect(saved.keyColors?.find((key) => key.matrixRow === 4 && key.matrixColumn === 2)?.color)
      .toEqual({ red: 0, green: 0, blue: 255 });
  });

  it("discards by writing the stored lighting back and saving it", async () => {
    const keyboard = new FakeRgbKeyboard();
    const { editor, reader } = editorAndReaderFor(keyboard);
    const preview = await editor.beginPreview();
    await preview.show({ layeredEffects: CYCLE_WITH_RT_DISPLAY, keyColors: BLUE_ON_ROW_FOUR });

    await preview.discard();

    expect([...keyboard.flash.get("core")!]).toEqual([...typingRgbCorePayload]);
    expect([...keyboard.flash.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
    expect([...keyboard.preview.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
    expect(reader.previewState.isPending(TYPING_SLOT)).toBe(false);
  });

  it("discards without writing when nothing was previewed", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await preview.discard();

    expect(keyboard.device.sentOutputReports).toHaveLength(0);
    expect(sentSaves(keyboard)).toBe(0);
  });

  it("cannot be used after it was saved or discarded", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();
    await preview.discard();

    await expect(preview.show({ brightnessPercent: 90 })).rejects.toBeInstanceOf(LightingPreviewEndedError);
  });

  it("continues from the stored bytes when a new preview starts while one is pending", async () => {
    const keyboard = new FakeRgbKeyboard();
    const editor = editorFor(keyboard);
    await (await editor.beginPreview()).show({ keyColors: BLUE_ON_ROW_FOUR });

    await (await editor.beginPreview()).discard();

    const eventsBeforeSave = keyboard.events.slice(0, keyboard.events.indexOf("save 1"));
    expect(eventsBeforeSave.filter((event) => event.startsWith("read"))).toEqual([
      "read core",
      "read upper",
      "read lower",
    ]);
    expect([...keyboard.flash.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
  });

  it("saves a plain change from the stored bytes while a preview is pending", async () => {
    const keyboard = new FakeRgbKeyboard();
    const editor = editorFor(keyboard);
    await (await editor.beginPreview()).show({ keyColors: BLUE_ON_ROW_FOUR });

    await editor.updateLighting({ brightnessPercent: 80 });

    expect([...keyboard.flash.get("lower")!]).toEqual([...tenzRgbRowsPayload]);
    expect(keyboard.flash.get("core")![3]).toBe(0xcc);
  });

  it("refuses to save when the active profile changed during the preview", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();
    await preview.show({ brightnessPercent: 90 });
    keyboard.activeSlot = 2;

    await expect(preview.save({ brightnessPercent: 90 }))
      .rejects.toBeInstanceOf(ActiveProfileChangedDuringLightingWriteError);
    expect(sentSaves(keyboard)).toBe(0);
  });

  it("drops a preview without writing once the keyboard switched profiles", async () => {
    const keyboard = new FakeRgbKeyboard();
    const { editor, reader } = editorAndReaderFor(keyboard);
    const preview = await editor.beginPreview();
    await preview.show({ brightnessPercent: 90 });
    keyboard.activeSlot = 2;
    const writesBeforeDiscard = keyboard.device.sentOutputReports.length;

    await preview.discard();

    expect(keyboard.device.sentOutputReports).toHaveLength(writesBeforeDiscard);
    expect(sentSaves(keyboard)).toBe(0);
    expect(reader.previewState.isPending(TYPING_SLOT)).toBe(false);
  });

  it("starts tracking a new preview on the profile the keyboard switched to", async () => {
    const keyboard = new FakeRgbKeyboard();
    const { editor, reader } = editorAndReaderFor(keyboard);
    await (await editor.beginPreview()).show({ brightnessPercent: 90 });
    keyboard.activeSlot = 2;

    await (await editor.beginPreview()).show({ brightnessPercent: 80 });

    expect(reader.previewState.isPending(TYPING_SLOT)).toBe(false);
    expect(reader.previewState.isPending(2)).toBe(true);
  });

  it("refuses invalid changes before showing them", async () => {
    const keyboard = new FakeRgbKeyboard();
    const preview = await editorFor(keyboard).beginPreview();

    await expect(preview.show({ brightnessPercent: 101 })).rejects.toThrow();
    expect(keyboard.device.sentOutputReports).toHaveLength(0);
  });
});
