import { useEffect, useRef, useState } from "react";
import type { AnalogKeyReading, AnalogKeySource } from "../../../keyboard/analog-keys";
import { keyLabel } from "../../../keyboard/hid-key-names";
import { describeError } from "../../../shared/describe-error";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Message } from "../../components/feedback";
import { PageHeader } from "../../components/PageHeader";

const IDLE_MESSAGE = "Press any key to see how far it travels.";

interface LiveKeysPageProps {
  readonly source: AnalogKeySource;
  readonly requestAccess: () => void;
}

export function LiveKeysPage({ source, requestAccess }: LiveKeysPageProps) {
  const pressedKeys = useAnalogKeys(source);
  const visibleKeys = pressedKeys.readings.filter((reading) => reading.depth > 0).sort(byMatrixPosition);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Live key input" description="How far each key is pressed, as the keyboard reports it." />
      <Card>
        {pressedKeys.accessProblem ? (
          <div className="flex flex-col gap-3">
            <Message>{pressedKeys.accessProblem}</Message>
            <div>
              <Button variant="primary" onClick={requestAccess}>
                Grant access
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-12 flex-col gap-2.5">
            {visibleKeys.length > 0 ? visibleKeys.map((reading) => (
              <KeyMeter key={`${reading.matrixRow}:${reading.matrixColumn}`} reading={reading} />
            )) : <Message>{IDLE_MESSAGE}</Message>}
          </div>
        )}
      </Card>
    </div>
  );
}

interface AnalogKeysState {
  readonly readings: readonly AnalogKeyReading[];
  readonly accessProblem?: string;
}

function useAnalogKeys(source: AnalogKeySource): AnalogKeysState {
  const [state, setState] = useState<AnalogKeysState>({ readings: [] });
  const latestReadings = useRef<readonly AnalogKeyReading[]>([]);
  const frameRequested = useRef(false);

  useEffect(() => {
    let disposed = false;
    let stopSubscription: (() => Promise<void>) | undefined;
    const scheduleRender = (readings: readonly AnalogKeyReading[]) => {
      latestReadings.current = readings;
      if (frameRequested.current) return;
      frameRequested.current = true;
      requestAnimationFrame(() => {
        frameRequested.current = false;
        if (!disposed) setState({ readings: latestReadings.current });
      });
    };
    source.start(scheduleRender).then(
      async (subscription) => {
        if (disposed) await subscription.stop();
        else stopSubscription = () => subscription.stop();
      },
      (error: unknown) => {
        if (!disposed) setState({ readings: [], accessProblem: describeError(error) });
      },
    );
    return () => {
      disposed = true;
      void stopSubscription?.();
    };
  }, [source]);

  return state;
}

function KeyMeter({ reading }: { readonly reading: AnalogKeyReading }) {
  const percent = Math.round(reading.depth * 100);
  return (
    <div className="grid grid-cols-[6rem_1fr_3rem] items-center gap-3 text-base">
      <span className="truncate font-bold text-strong">{keyLabel(reading)}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-sunken">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </span>
      <span className="text-right tabular-nums text-muted">{percent}%</span>
    </div>
  );
}

function byMatrixPosition(first: AnalogKeyReading, second: AnalogKeyReading): number {
  return first.matrixRow - second.matrixRow || first.matrixColumn - second.matrixColumn;
}
