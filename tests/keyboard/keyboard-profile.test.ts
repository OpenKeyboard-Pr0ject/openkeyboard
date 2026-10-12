import { describe, expect, it } from "vitest";
import { assertWithinRange, SettingOutOfRangeError } from "../../src/keyboard/keyboard-profile";

const actuationRange = { min: 0.1, max: 4.0, step: 0.05 };

describe("assertWithinRange", () => {
  it.each([0.1, 0.15, 1.0, 2.35, 4.0])("accepts %s mm", (value) => {
    expect(() => assertWithinRange("Actuation point", value, actuationRange)).not.toThrow();
  });

  it.each([0.05, 4.05, 1.02, Number.NaN])("rejects %s mm", (value) => {
    expect(() => assertWithinRange("Actuation point", value, actuationRange)).toThrow(SettingOutOfRangeError);
  });
});
