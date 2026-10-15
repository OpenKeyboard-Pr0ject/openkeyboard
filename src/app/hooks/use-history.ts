import { useCallback, useState } from "react";
import {
  canRedo,
  canUndo,
  type History,
  historyRedone,
  historyStartingAt,
  historyUndone,
  historyWith,
} from "./history";

export interface HistoryControls<Value> {
  readonly present: Value;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  update(change: (present: Value) => Value): void;
  undo(): void;
  redo(): void;
  reset(present: Value): void;
}

export function useHistory<Value>(initial: () => Value): HistoryControls<Value> {
  const [history, setHistory] = useState<History<Value>>(() => historyStartingAt(initial()));
  const update = useCallback(
    (change: (present: Value) => Value) => setHistory((current) => historyWith(current, change(current.present))),
    [],
  );
  const undo = useCallback(() => setHistory(historyUndone), []);
  const redo = useCallback(() => setHistory(historyRedone), []);
  const reset = useCallback((present: Value) => setHistory(historyStartingAt(present)), []);
  return {
    present: history.present,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    update,
    undo,
    redo,
    reset,
  };
}
