import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  historyRedone,
  historyStartingAt,
  historyUndone,
  historyWith,
} from "../../src/app/hooks/history";

describe("undo history", () => {
  it("undoes and redoes changes in order", () => {
    const edited = historyWith(historyWith(historyStartingAt("a"), "b"), "c");

    const undone = historyUndone(historyUndone(edited));
    expect(undone.present).toBe("a");
    expect(canUndo(undone)).toBe(false);
    expect(historyRedone(undone).present).toBe("b");
  });

  it("forgets redo steps after a new change", () => {
    const branched = historyWith(historyUndone(historyWith(historyStartingAt(1), 2)), 3);

    expect(branched.present).toBe(3);
    expect(canRedo(branched)).toBe(false);
  });

  it("ignores a change to the same value", () => {
    const start = historyStartingAt("same");

    expect(historyWith(start, "same")).toBe(start);
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const start = historyStartingAt(0);

    expect(historyUndone(start)).toBe(start);
    expect(historyRedone(start)).toBe(start);
  });

  it("keeps at most 100 undo steps", () => {
    let history = historyStartingAt(0);
    for (let value = 1; value <= 150; value += 1) history = historyWith(history, value);

    expect(history.past).toHaveLength(100);
    expect(history.past[0]).toBe(50);
  });
});
