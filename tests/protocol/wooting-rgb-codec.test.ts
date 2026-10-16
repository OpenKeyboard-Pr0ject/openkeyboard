import { describe, expect, it } from "vitest";
import {
  colorFromRgb565,
  decodeRgbCore,
  decodeRgbFrame,
  decodeRgbRows,
  IncompleteRgbFrameError,
} from "../../src/protocol/wooting/wooting-rgb-codec";
import {
  tenzRgbCorePayload,
  tenzRgbRowsPayload,
  typingRgbCorePayload,
  typingWaveRgbFramePayload,
  ultraRgbCorePayload,
} from "../fakes/wooting-80he-captures";

const WOOTING_80HE_FRAME = { rows: 6, columns: 17 };

describe("Wooting RGB codec", () => {
  it("reads the brightness of each profile as Wootility shows it", () => {
    expect([tenzRgbCorePayload, typingRgbCorePayload, ultraRgbCorePayload].map(
      (payload) => decodeRgbCore(payload).brightnessPercent,
    )).toEqual([70, 100, 44]);
  });

  it("notices effect layers only on the profile that runs an animated effect", () => {
    expect([tenzRgbCorePayload, typingRgbCorePayload, ultraRgbCorePayload].map(
      (payload) => decodeRgbCore(payload).hasEffectLayers,
    )).toEqual([false, true, false]);
  });

  it("reads three rows of 21 key colors per report", () => {
    const colors = decodeRgbRows(tenzRgbRowsPayload, 3);

    expect(colors).toHaveLength(63);
    expect(colors[0]).toEqual({ matrixRow: 3, matrixColumn: 0, color: { red: 255, green: 0, blue: 0 } });
    expect(colors[62]).toMatchObject({ matrixRow: 5, matrixColumn: 20 });
  });

  it("expands RGB565 to full 8-bit channels", () => {
    expect(colorFromRgb565(0xf800)).toEqual({ red: 255, green: 0, blue: 0 });
    expect(colorFromRgb565(0xff60)).toEqual({ red: 255, green: 239, blue: 0 });
    expect(colorFromRgb565(0xffff)).toEqual({ red: 255, green: 255, blue: 255 });
  });

  it("reads the lighting frame the keyboard shows, one RGB565 color per matrix position", () => {
    const frame = decodeRgbFrame(typingWaveRgbFramePayload, WOOTING_80HE_FRAME);

    expect(frame).toHaveLength(102);
    expect(frame[0]).toEqual({ matrixRow: 0, matrixColumn: 0, color: colorFromRgb565(0xf815) });
    expect(frame[16]).toEqual({ matrixRow: 0, matrixColumn: 16, color: colorFromRgb565(0xf809) });
    expect(frame[17]).toEqual({ matrixRow: 1, matrixColumn: 0, color: colorFromRgb565(0xf815) });
    expect(frame.at(-1)).toEqual({ matrixRow: 5, matrixColumn: 16, color: colorFromRgb565(0xf809) });
  });

  it("refuses a lighting frame that is too short for the keyboard", () => {
    expect(() => decodeRgbFrame(typingWaveRgbFramePayload.subarray(0, 200), WOOTING_80HE_FRAME))
      .toThrow(IncompleteRgbFrameError);
  });
});
