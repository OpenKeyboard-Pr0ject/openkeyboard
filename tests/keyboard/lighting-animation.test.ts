import { describe, expect, it } from "vitest";
import { animatedBoardOf, KeyPressTracker } from "../../src/keyboard/lighting-animation";
import type { PhysicalLayout } from "../../src/keyboard/physical-layout";

const LAYOUT: PhysicalLayout = {
  name: "Two keys",
  keys: [
    { label: "A", matrixRow: 0, matrixColumn: 0, x: 0, y: 0, width: 1, height: 1 },
    { label: "Space", matrixRow: 1, matrixColumn: 3, x: 1, y: 1, width: 6, height: 1 },
  ],
};

describe("animated board", () => {
  it("places every key at its center and keeps the board size", () => {
    expect(animatedBoardOf(LAYOUT)).toEqual({
      keys: [{ id: "0:0", centerX: 0.5, centerY: 0.5 }, { id: "1:3", centerX: 4, centerY: 1.5 }],
      width: 7,
      height: 2,
    });
  });
});

describe("key press tracker", () => {
  it("starts a press, follows its depth and ends it on release", () => {
    const tracker = new KeyPressTracker();
    tracker.update("0:0", 0.4, 1);
    tracker.update("0:0", 0.9, 1.1);
    expect(tracker.presses(1.1)).toEqual([{ keyId: "0:0", sequence: 0, pressedAt: 1, depth: 0.9 }]);
    tracker.update("0:0", 0, 1.5);
    expect(tracker.presses(1.5)).toEqual([{ keyId: "0:0", sequence: 0, pressedAt: 1, depth: 0.9, releasedAt: 1.5 }]);
  });

  it("numbers presses in order and ignores releases of keys that are not pressed", () => {
    const tracker = new KeyPressTracker();
    tracker.update("0:0", 0, 0);
    tracker.update("0:0", 1, 1);
    tracker.update("1:3", 1, 2);
    expect(tracker.presses(2).map((press) => press.sequence)).toEqual([0, 1]);
  });

  it("forgets released presses after the retention time", () => {
    const tracker = new KeyPressTracker(2);
    tracker.update("0:0", 1, 0);
    tracker.update("0:0", 0, 1);
    expect(tracker.presses(3)).toHaveLength(1);
    expect(tracker.presses(3.5)).toEqual([]);
  });

  it("releases streamed keys that stop being reported, without touching held keys", () => {
    const tracker = new KeyPressTracker();
    tracker.update("1:3", 1, 0);
    tracker.replaceStreamedKeys(new Map([["0:0", 0.5]]), 1);
    tracker.replaceStreamedKeys(new Map(), 2);
    const presses = tracker.presses(2);
    expect(presses.find((press) => press.keyId === "0:0")?.releasedAt).toBe(2);
    expect(presses.find((press) => press.keyId === "1:3")?.releasedAt).toBeUndefined();
  });
});
