import { describe, expect, it } from "vitest";
import {
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
    if (id === WootingCommand.getCurrentProfileIndex) return replyCarrying(id, payloadOf(`0${TYPING_SLOT}00`));
    if (id === WootingCommand.getProfileMetadata) return replyCarrying(id, typingProfileMetadataPayload);
    if (id === WootingCommand.saveRgbProfile) {
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
  const commands = new WootingCommandChannel(keyboard.device.asHidDevice());
  return new WootingLightingEditor(commands, new WootingLightingReader(commands));
}

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

    expect(keyboard.device.sentOutputReports.map(({ data }) => [data[2], data[3]])).toEqual([
      [0x16, 0x00],
      [0x0e, 0x00],
      [0x0f, 0x00],
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

  it("reads every part before the first preview, because the 80HE garbles rows read during a preview", async () => {
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
