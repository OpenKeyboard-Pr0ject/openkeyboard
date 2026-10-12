export interface AnalogKeyReading {
  readonly hidUsage: number;
  readonly matrixRow: number;
  readonly matrixColumn: number;
  readonly depth: number;
}

export type AnalogKeyListener = (pressedKeys: readonly AnalogKeyReading[]) => void;

export interface AnalogKeySubscription {
  stop(): Promise<void>;
}

export interface AnalogKeySource {
  start(listener: AnalogKeyListener): Promise<AnalogKeySubscription>;
}
