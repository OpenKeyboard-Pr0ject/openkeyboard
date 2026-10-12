import type { MatrixKey } from "./matrix-key";

export interface AnalogKeyReading extends MatrixKey {
  readonly depth: number;
}

export type AnalogKeyListener = (pressedKeys: readonly AnalogKeyReading[]) => void;

export interface AnalogKeySubscription {
  stop(): Promise<void>;
}

export interface AnalogKeySource {
  start(listener: AnalogKeyListener): Promise<AnalogKeySubscription>;
}
