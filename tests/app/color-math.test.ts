import { describe, expect, it } from "vitest";
import { hsvFromRgb, rgbFromHsv } from "../../src/app/components/color-math";
import { withRecentColor } from "../../src/app/hooks/use-recent-colors";

describe("color math", () => {
  it.each([
    [{ red: 255, green: 0, blue: 0 }, { hue: 0, saturation: 1, value: 1 }],
    [{ red: 0, green: 255, blue: 0 }, { hue: 120, saturation: 1, value: 1 }],
    [{ red: 0, green: 0, blue: 255 }, { hue: 240, saturation: 1, value: 1 }],
    [{ red: 255, green: 0, blue: 255 }, { hue: 300, saturation: 1, value: 1 }],
    [{ red: 0, green: 0, blue: 0 }, { hue: 0, saturation: 0, value: 0 }],
    [{ red: 255, green: 255, blue: 255 }, { hue: 0, saturation: 0, value: 1 }],
  ])("converts %o to hue, saturation and value", (rgb, hsv) => {
    expect(hsvFromRgb(rgb)).toEqual(hsv);
  });

  it("converts every primary and secondary hue back to the same color", () => {
    for (const color of [
      { red: 255, green: 128, blue: 0 },
      { red: 12, green: 200, blue: 90 },
      { red: 40, green: 40, blue: 220 },
      { red: 77, green: 77, blue: 77 },
    ]) {
      expect(rgbFromHsv(hsvFromRgb(color))).toEqual(color);
    }
  });

  it("wraps hues outside one turn", () => {
    expect(rgbFromHsv({ hue: 360, saturation: 1, value: 1 })).toEqual({ red: 255, green: 0, blue: 0 });
  });
});

describe("recently used colors", () => {
  it("puts the newest color first without duplicates and keeps twelve", () => {
    const colors = Array.from({ length: 12 }, (_, index) => `#0000${index.toString(16).padStart(2, "0")}`);

    const updated = withRecentColor(colors, "#00000A");

    expect(updated[0]).toBe("#00000a");
    expect(updated.filter((color) => color === "#00000a")).toHaveLength(1);
    expect(updated).toHaveLength(12);
  });
});
