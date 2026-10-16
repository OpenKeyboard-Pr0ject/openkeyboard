import { useEffect, useState } from "react";
import type { KeyboardProfileReader } from "../../../keyboard/keyboard-profile";

const ACTIVE_PROFILE_CHECK_MILLISECONDS = 1000;

export function useActiveProfileSlot(profiles: KeyboardProfileReader | undefined): number | undefined {
  const [activeSlot, setActiveSlot] = useState<number>();

  useEffect(() => {
    setActiveSlot(undefined);
    if (!profiles) return undefined;
    let disposed = false;
    let checking = false;
    const check = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const slot = await profiles.readActiveSlot();
        if (!disposed) setActiveSlot(slot);
      } catch {
        return;
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), ACTIVE_PROFILE_CHECK_MILLISECONDS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [profiles]);

  return activeSlot;
}
