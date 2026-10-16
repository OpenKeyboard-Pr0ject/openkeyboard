import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalogKeyReading, AnalogKeySource } from "../../../keyboard/analog-keys";
import {
  colorFromHex,
  colorToHex,
  type KeyColor,
  type LightingFrameReader,
  type RgbColor,
} from "../../../keyboard/lighting";
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
const FAILED_FRAME_READS_BEFORE_DRAWING = 3;
const FAILED_FRAME_RETRY_MILLISECONDS = 250;
const HIDDEN_PAGE_RECHECK_MILLISECONDS = 500;

export type EffectAnimationSource = "key-colors" | "keyboard" | "drawn";

interface EffectAnimationOptions {
  readonly animator: LayeredEffectAnimator | undefined;
  readonly layout: PhysicalLayout;
  readonly effects: LayeredEffects;
  readonly keyColors: ReadonlyMap<string, string>;
  readonly isRunning: boolean;
  readonly analogKeys: AnalogKeySource | undefined;
  readonly frames: LightingFrameReader | undefined;
  readonly keyboardShowsDraft: boolean;
  readonly holdsKeyboardFrames: boolean;
}

export interface EffectAnimation {
  readonly fills: ReadonlyMap<string, string> | undefined;
  readonly source: EffectAnimationSource;
  readonly respondsToKeyPresses: boolean;
  readonly holdKey: (keyId: string, isHeld: boolean) => void;
}

export function useEffectAnimation(options: EffectAnimationOptions): EffectAnimation {
  const { animator, effects, frames, keyboardShowsDraft } = options;
  const [framesFailed, setFramesFailed] = useState(false);
  const isAnimated = animator?.isAnimated(effects) ?? false;
  const readsKeyboard = isAnimated && frames !== undefined && keyboardShowsDraft && !framesFailed;

  useEffect(() => setFramesFailed(false), [frames]);

  const keyboardFills = useKeyboardFrames(
    readsKeyboard ? frames : undefined,
    options.isRunning,
    options.holdsKeyboardFrames,
    () => setFramesFailed(true),
  );
  const drawn = useDrawnEffects({ ...options, isAnimated: isAnimated && !readsKeyboard });

  if (!isAnimated) return { ...drawn, fills: undefined, source: "key-colors" };
  if (readsKeyboard) {
    return { fills: keyboardFills, source: "keyboard", respondsToKeyPresses: false, holdKey: drawn.holdKey };
  }
  return { ...drawn, source: "drawn" };
}

function useKeyboardFrames(
  frames: LightingFrameReader | undefined,
  isRunning: boolean,
  isHeld: boolean,
  onUnreadable: () => void,
): ReadonlyMap<string, string> | undefined {
  const [fills, setFills] = useState<ReadonlyMap<string, string>>();
  const onUnreadableRef = useRef(onUnreadable);
  onUnreadableRef.current = onUnreadable;

  useEffect(() => {
    if (!frames) setFills(undefined);
  }, [frames]);

  useEffect(() => {
    if (!frames || isHeld) return undefined;
    let disposed = false;
    let failedReads = 0;
    const readFrames = async () => {
      let lastReadAt = Number.NEGATIVE_INFINITY;
      while (!disposed) {
        await delay(Math.max(0, lastReadAt + FRAME_INTERVAL_MILLISECONDS - performance.now()));
        if (disposed) return;
        if (document.hidden) {
          await delay(HIDDEN_PAGE_RECHECK_MILLISECONDS);
          continue;
        }
        lastReadAt = performance.now();
        try {
          const frame = await frames.readFrame();
          if (disposed) return;
          failedReads = 0;
          setFills(fillsOf(frame));
          if (!isRunning) return;
        } catch {
          failedReads += 1;
          if (failedReads >= FAILED_FRAME_READS_BEFORE_DRAWING) {
            if (!disposed) onUnreadableRef.current();
            return;
          }
          await delay(FAILED_FRAME_RETRY_MILLISECONDS);
        }
      }
    };
    void readFrames();
    return () => {
      disposed = true;
    };
  }, [frames, isRunning, isHeld]);

  return frames ? fills : undefined;
}

interface DrawnEffectsOptions extends EffectAnimationOptions {
  readonly isAnimated: boolean;
}

function useDrawnEffects(
  { animator, layout, effects, keyColors, isRunning, analogKeys, isAnimated }: DrawnEffectsOptions,
): Omit<EffectAnimation, "source"> {
  const board = useMemo(() => animatedBoardOf(layout), [layout]);
  const rgbKeyColors = useMemo(
    () => new Map([...keyColors].map(([keyId, hex]): [string, RgbColor] => [keyId, colorFromHex(hex)])),
    [keyColors],
  );
  const tracker = useRef(new KeyPressTracker());
  const [fills, setFills] = useState<ReadonlyMap<string, string>>();
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

function fillsOf(frame: readonly KeyColor[]): ReadonlyMap<string, string> {
  return new Map(frame.map((keyColor) => [matrixKeyId(keyColor), colorToHex(keyColor.color)]));
}

function depthsByKeyId(readings: readonly AnalogKeyReading[]): ReadonlyMap<string, number> {
  return new Map(readings.map((reading) => [matrixKeyId(reading), reading.depth]));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nowInSeconds(): number {
  return performance.now() / MILLISECONDS_PER_SECOND;
}
