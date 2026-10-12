import { describe, expect, it } from "vitest";
import { decodeWootingAnalogReport } from "../../src/protocol/wooting/wooting-analog-codec";
import {
  analogReportAStartingToMove,
  analogReportEscapePressed,
  analogReportFourKeysHeld,
  analogReportNoKeysHeld,
} from "../fakes/wooting-80he-captures";

describe("decodeWootingAnalogReport", () => {
  it("returns no readings when no key is held", () => {
    expect(decodeWootingAnalogReport(analogReportNoKeysHeld)).toEqual([]);
  });

  it("splits the matrix position byte into row and column", () => {
    const [reading] = decodeWootingAnalogReport(analogReportAStartingToMove);

    expect(reading).toMatchObject({ hidUsage: 0x04, matrixRow: 3, matrixColumn: 1 });
  });

  it("scales the little-endian travel value against full travel", () => {
    const [reading] = decodeWootingAnalogReport(analogReportAStartingToMove);

    expect(reading!.depth).toBeCloseTo(0x0800 / 0xffc1, 6);
  });

  it("keeps the key in the first matrix position although its position byte is zero", () => {
    const [reading] = decodeWootingAnalogReport(analogReportEscapePressed);

    expect(reading).toMatchObject({ hidUsage: 0x29, matrixRow: 0, matrixColumn: 0 });
  });

  it("decodes every key held at the same time", () => {
    const usages = decodeWootingAnalogReport(analogReportFourKeysHeld).map((reading) => reading.hidUsage);

    expect(usages).toEqual([0x08, 0x16, 0x17, 0x2c]);
  });

  it("reports a fully pressed key as full depth", () => {
    const space = decodeWootingAnalogReport(analogReportFourKeysHeld).at(-1);

    expect(space!.depth).toBe(1);
  });

  it("never reports more than full depth", () => {
    const [reading] = decodeWootingAnalogReport(new Uint8Array([0x61, 0x04, 0xff, 0xff]));

    expect(reading!.depth).toBe(1);
  });
});
