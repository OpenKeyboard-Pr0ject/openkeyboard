import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalogKeyReading, AnalogKeySource } from "../../../keyboard/analog-keys";
import { colorFromHex, colorToHex, type RgbColor } from "../../../keyboard/lighting";
import {
  animatedBoardOf,
  KeyPressTracker,
  type LayeredEffectAnimator,
} from "../../../keyboard/lighting-animation";
import type { LayeredEffects } from "../../../keyboard/lighting-effects";
import { matrixKeyId, type PhysicalLayout } from "../../../keyboard/physical-layout";

const FRAMES_PER_SECOND = 30;
const MILLISECONDS_PER_SECOND = 1000;
const FRAME_INTERVAL_MILLISECONDS = MILLISECONDS_PER_SECOND / FRAMES_PER_SECOND;
const HELD_KEY_DEPTH = 1;

interface EffectAnimationOptions {
  readonly animator: LayeredEffectAnimator | undefined;
  readonly layout: PhysicalLayout;
  readonly effects: LayeredEffects;
  readonly keyColors: ReadonlyMap<string, string>;
  readonly isRunning: boolean;
  readonly analogKeys: AnalogKeySource | undefined;
}

export interface EffectAnimation {
  readonly fills: ReadonlyMap<string, string> | undefined;
  readonly respondsToKeyPresses: boolean;
  readonly holdKey: (keyId: string, isHeld: boolean) => void;
}

export function useEffectAnimation(
  { animator, layout, effects, keyColors, isRunning, analogKeys }: EffectAnimationOptions,
): EffectAnimation {
  const board = useMemo(() => animatedBoardOf(layout), [layout]);
  const rgbKeyColors = useMemo(
    () => new Map([...keyColors].map(([keyId, hex]): [string, RgbColor] => [keyId, colorFromHex(hex)])),
    [keyColors],
  );
  const tracker = useRef(new KeyPressTracker());
  const [fills, setFills] = useState<ReadonlyMap<string, string>>();
  const isAnimated = animator?.isAnimated(effects) ?? false;
  const respondsToKeyPresses = isAnimated && (animator?.respondsToKeyPresses(effects) ?? false);

  useEffect(() => {
    if (!animator || !isAnimated) {
      setFills(undefined);
      return undefined;
    }
    const renderAt = (timeSeconds: number) => {
      const colors = animator.frame({
        board,
        effects,
        keyColors: rgbKeyColors,
        presses: tracker.current.presses(timeSeconds),
        timeSeconds,
      });
      setFills(new Map([...colors].map(([keyId, color]) => [keyId, colorToHex(color)])));
    };
    if (!isRunning) {
      renderAt(nowInSeconds());
      return undefined;
    }
    let frameRequest = 0;
    let lastFrameAt = Number.NEGATIVE_INFINITY;
    const onAnimationFrame = (timestamp: number) => {
      frameRequest = requestAnimationFrame(onAnimationFrame);
      if (timestamp - lastFrameAt < FRAME_INTERVAL_MILLISECONDS) return;
      lastFrameAt = timestamp;
      renderAt(nowInSeconds());
    };
    frameRequest = requestAnimationFrame(onAnimationFrame);
    return () => cancelAnimationFrame(frameRequest);
  }, [animator, isAnimated, isRunning, board, effects, rgbKeyColors]);

  const listensToAnalogKeys = isRunning && respondsToKeyPresses && analogKeys !== undefined;
  useEffect(() => {
    if (!listensToAnalogKeys || !analogKeys) return undefined;
    let disposed = false;
    let stopSubscription: (() => Promise<void>) | undefined;
    const onReadings = (readings: readonly AnalogKeyReading[]) => {
      tracker.current.replaceStreamedKeys(depthsByKeyId(readings), nowInSeconds());
    };
    analogKeys.start(onReadings).then(
      async (subscription) => {
        if (disposed) await subscription.stop();
        else stopSubscription = () => subscription.stop();
      },
      () => undefined,
    );
    return () => {
      disposed = true;
      tracker.current.replaceStreamedKeys(new Map(), nowInSeconds());
      void stopSubscription?.();
    };
  }, [analogKeys, listensToAnalogKeys]);

  const holdKey = useCallback((keyId: string, isHeld: boolean) => {
    tracker.current.update(keyId, isHeld ? HELD_KEY_DEPTH : 0, nowInSeconds());
  }, []);

  return { fills, respondsToKeyPresses, holdKey };
}

function depthsByKeyId(readings: readonly AnalogKeyReading[]): ReadonlyMap<string, number> {
  return new Map(readings.map((reading) => [matrixKeyId(reading), reading.depth]));
}

function nowInSeconds(): number {
  return performance.now() / MILLISECONDS_PER_SECOND;
}
