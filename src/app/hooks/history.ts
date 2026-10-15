const MAXIMUM_UNDO_STEPS = 100;

export interface History<Value> {
  readonly past: readonly Value[];
  readonly present: Value;
  readonly future: readonly Value[];
}

export function historyStartingAt<Value>(present: Value): History<Value> {
  return { past: [], present, future: [] };
}

export function historyWith<Value>(history: History<Value>, next: Value): History<Value> {
  if (Object.is(next, history.present)) return history;
  return {
    past: [...history.past, history.present].slice(-MAXIMUM_UNDO_STEPS),
    present: next,
    future: [],
  };
}

export function historyUndone<Value>(history: History<Value>): History<Value> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function historyRedone<Value>(history: History<Value>): History<Value> {
  const [next, ...remaining] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: remaining };
}

export function canUndo(history: History<unknown>): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History<unknown>): boolean {
  return history.future.length > 0;
}
