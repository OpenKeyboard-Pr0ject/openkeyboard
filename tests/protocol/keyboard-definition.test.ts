import { describe, expect, it } from "vitest";
import {
  KeyboardDefinitionError,
  parseKeyboardDefinition,
  unpackLayoutOptions,
  visiblePhysicalKeys,
} from "../../src/protocol/via/keyboard-definition";
import { decompressXzText } from "../../src/protocol/via/xz-text";
import { TEST_MACROPAD_DEFINITION_JSON, TEST_MACROPAD_DEFINITION_XZ } from "../fakes/fake-via-keyboard";

const definition = parseKeyboardDefinition(TEST_MACROPAD_DEFINITION_JSON);

describe("parseKeyboardDefinition", () => {
  it("reads the name and matrix size", () => {
    expect([definition.name, definition.matrixRows, definition.matrixColumns]).toEqual(["Test Macropad", 2, 3]);
  });

  it("keeps matrix keys and drops decals and encoders", () => {
    expect(definition.keys).toHaveLength(7);
  });

  it("counts the choices of every layout option", () => {
    expect(definition.layoutOptionSizes).toEqual([2]);
  });

  it("rejects a definition without a matrix size", () => {
    expect(() => parseKeyboardDefinition(JSON.stringify({ layouts: { keymap: [] } }))).toThrow(KeyboardDefinitionError);
  });

  it("rejects text that is not JSON", () => {
    expect(() => parseKeyboardDefinition("not json")).toThrow(KeyboardDefinitionError);
  });
});

describe("visiblePhysicalKeys", () => {
  it("shows the first choice of each layout option by default", () => {
    const keys = visiblePhysicalKeys(definition, 0);

    expect(keys.filter((key) => key.matrixRow === 1).map((key) => key.width)).toEqual([1, 1, 1]);
  });

  it("swaps in the keys of the selected layout choice", () => {
    const keys = visiblePhysicalKeys(definition, 1);

    expect(keys.filter((key) => key.matrixRow === 1).map((key) => [key.x, key.y, key.width])).toEqual([[0, 1, 3]]);
  });
});

describe("unpackLayoutOptions", () => {
  it("reads the last option from the lowest bits like VIA and Vial do", () => {
    expect(unpackLayoutOptions([2, 3, 2], 0b1101)).toEqual([1, 2, 1]);
  });

  it("gives options with a single choice no bits", () => {
    expect(unpackLayoutOptions([1, 2], 0b1)).toEqual([0, 1]);
  });
});

describe("decompressXzText", () => {
  it("unpacks a definition compressed by Python's lzma like the Vial build does", async () => {
    const definitionJson = await decompressXzText(TEST_MACROPAD_DEFINITION_XZ);

    expect(JSON.parse(definitionJson)).toEqual(JSON.parse(TEST_MACROPAD_DEFINITION_JSON));
  });
});
