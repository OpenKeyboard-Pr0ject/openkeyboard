import { useCallback, useState } from "react";

export function useStoredFlag(storageKey: string, initial: boolean): readonly [boolean, (value: boolean) => void] {
  const [flag, setFlag] = useState(() => readFlag(storageKey, initial));
  const update = useCallback((value: boolean) => {
    setFlag(value);
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      return;
    }
  }, [storageKey]);
  return [flag, update];
}

function readFlag(storageKey: string, initial: boolean): boolean {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === null ? initial : stored === "true";
  } catch {
    return initial;
  }
}
