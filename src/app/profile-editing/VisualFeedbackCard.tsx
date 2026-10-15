import { useEffect, useRef, useState } from "react";
import type { AnalogKeyReading, AnalogKeySource } from "../../keyboard/analog-keys";
import { keyLabel } from "../../keyboard/hid-key-names";
import type { MatrixKey } from "../../keyboard/matrix-key";
import { Card } from "../components/Card";
import { Message } from "../components/feedback";

const PERCENT = 100;
const FEEDBACK_DESCRIPTION = "Press a key to test its actuation point. The bar turns yellow once the key activates.";
const PRESSED_KEY_CLASSES =
  "flex h-16 min-w-16 items-center justify-center rounded-md bg-keycap px-3 font-bold text-keycap-legend";

interface VisualFeedbackCardProps {
  readonly source: AnalogKeySource;
  readonly fullTravelMillimeters: number;
  readonly actuationOf: (key: MatrixKey) => number;
}

export function VisualFeedbackCard({ source, fullTravelMillimeters, actuationOf }: VisualFeedbackCardProps) {
  const deepestKey = useDeepestPressedKey(source);
  const pressedMillimeters = deepestKey ? deepestKey.depth * fullTravelMillimeters : 0;
  const actuationMillimeters = deepestKey ? actuationOf(deepestKey) : undefined;
  const isActivated = actuationMillimeters !== undefined && pressedMillimeters >= actuationMillimeters;
  return (
    <Card title="Visual Feedback" description={FEEDBACK_DESCRIPTION}>
      <div className="flex items-end gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold tracking-wide text-fg uppercase">Pressed key</span>
          <span className={PRESSED_KEY_CLASSES}>
            {deepestKey ? keyLabel(deepestKey) : "Key"}
          </span>
        </div>
        <div className="relative h-32 w-4 overflow-hidden rounded-full bg-sunken">
          <span
            className={[
              "absolute inset-x-0 top-0 rounded-full transition-colors",
              isActivated ? "bg-accent" : "bg-faint",
            ].join(" ")}
            style={{ height: `${Math.min(PERCENT, (pressedMillimeters / fullTravelMillimeters) * PERCENT)}%` }}
          />
          {actuationMillimeters !== undefined && (
            <span
              className="absolute inset-x-0 h-0.5 bg-strong"
              style={{ top: `${(actuationMillimeters / fullTravelMillimeters) * PERCENT}%` }}
            />
          )}
        </div>
        <div className="text-sm text-muted tabular-nums">
          {deepestKey && actuationMillimeters !== undefined ? (
            <>
              <p className="m-0">Pressed {pressedMillimeters.toFixed(2)} mm</p>
              <p className="m-0">Actuates at {actuationMillimeters.toFixed(2)} mm</p>
            </>
          ) : <Message>Waiting for a key press.</Message>}
        </div>
      </div>
    </Card>
  );
}

function useDeepestPressedKey(source: AnalogKeySource): AnalogKeyReading | undefined {
  const [deepestKey, setDeepestKey] = useState<AnalogKeyReading>();
  const frameRequested = useRef(false);
  const latest = useRef<AnalogKeyReading | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let stopSubscription: (() => Promise<void>) | undefined;
    const onReadings = (readings: readonly AnalogKeyReading[]) => {
      latest.current = [...readings].sort((first, second) => second.depth - first.depth)[0];
      if (frameRequested.current) return;
      frameRequested.current = true;
      requestAnimationFrame(() => {
        frameRequested.current = false;
        if (!disposed) setDeepestKey(latest.current);
      });
    };
    source.start(onReadings).then(
      async (subscription) => {
        if (disposed) await subscription.stop();
        else stopSubscription = () => subscription.stop();
      },
      () => undefined,
    );
    return () => {
      disposed = true;
      void stopSubscription?.();
    };
  }, [source]);

  return deepestKey;
}
