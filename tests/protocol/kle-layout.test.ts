import { describe, expect, it } from "vitest";
import { KleLayoutError, parseKleKeys } from "../../src/protocol/via/kle-layout";

describe("parseKleKeys", () => {
  it("places keys left to right and moves down one unit per row", () => {
    const keys = parseKleKeys([["a", "b"], ["c"]]);

    expect(keys.map(({ x, y }) => [x, y])).toEqual([[0, 0], [1, 0], [0, 1]]);
  });

  it("applies width, height and offsets to the next key only", () => {
    const keys = parseKleKeys([[{ x: 0.5, w: 2, h: 2 }, "wide", "normal"]]);

    expect(keys.map(({ x, width, height }) => [x, width, height])).toEqual([[0.5, 2, 2], [2.5, 1, 1]]);
  });

  it("moves a whole row with a vertical offset", () => {
    const keys = parseKleKeys([["a"], [{ y: 0.25 }, "b", "c"]]);

    expect(keys.slice(1).map((key) => key.y)).toEqual([1.25, 1.25]);
  });

  it("puts the fourth legend line into label slot 8 under the default alignment", () => {
    const [key] = parseKleKeys([["1,0\n\n\n0,1"]]);

    expect([key.labels[0], key.labels[8]]).toEqual(["1,0", "0,1"]);
  });

  it("puts the tenth legend line into label slot 4 under the default alignment", () => {
    const [key] = parseKleKeys([["0,0\n\n\n\n\n\n\n\n\ne"]]);

    expect(key.labels[4]).toBe("e");
  });

  it("moves the first legend into the center slot when the alignment centers everything", () => {
    const [key] = parseKleKeys([[{ a: 7 }, "Esc"]]);

    expect(key.labels[4]).toBe("Esc");
  });

  it("marks decal keys", () => {
    const keys = parseKleKeys([[{ d: true }, "logo", "key"]]);

    expect(keys.map((key) => key.decal)).toEqual([true, false]);
  });

  it("accepts keyboard metadata as the first element", () => {
    expect(parseKleKeys([{ name: "Board" }, ["a"]])).toHaveLength(1);
  });

  it("rejects metadata anywhere else", () => {
    expect(() => parseKleKeys([["a"], { name: "Board" }])).toThrow(KleLayoutError);
  });
});
