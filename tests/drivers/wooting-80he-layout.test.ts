import { describe, expect, it } from "vitest";
import { WOOTING_80HE_LAYOUT } from "../../src/drivers/wooting/wooting-80he-layout";
import { layoutSize, matrixKeyId } from "../../src/keyboard/physical-layout";
import { decodeKeyMapping } from "../../src/protocol/wooting/wooting-profile-codec";
import { keyMappingPayload } from "../fakes/wooting-80he-captures";

describe("Wooting 80HE layout", () => {
  const mappedPositions = new Set(decodeKeyMapping(keyMappingPayload).map(matrixKeyId));

  it("draws every key of the ANSI board once", () => {
    const ids = WOOTING_80HE_LAYOUT.keys.map(matrixKeyId);

    expect(ids).toHaveLength(84);
    expect(new Set(ids).size).toBe(84);
  });

  it("places each key on a matrix position that the keyboard maps", () => {
    const unmapped = WOOTING_80HE_LAYOUT.keys.filter((key) => !mappedPositions.has(matrixKeyId(key)));

    expect(unmapped.map((key) => key.label)).toEqual([]);
  });

  it("uses the matrix position the analog stream reports for the Spacebar", () => {
    const spacebar = WOOTING_80HE_LAYOUT.keys.find((key) => key.label === "Spacebar");

    expect(spacebar).toMatchObject({ matrixRow: 5, matrixColumn: 6, width: 6.25 });
  });

  it("is 17.25 keys wide and 6.25 keys tall", () => {
    expect(layoutSize(WOOTING_80HE_LAYOUT)).toEqual({ width: 17.25, height: 6.25 });
  });
});
