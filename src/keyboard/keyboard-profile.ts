import type { MatrixKey } from "./matrix-key";

export interface KeyActuation {
  readonly key: MatrixKey;
  readonly actuationMillimeters: number;
}

export interface RapidTriggerSettings {
  readonly enabled: boolean;
  readonly sensitivityMillimeters: number;
  readonly continuous: boolean;
}

export interface KeyboardProfile {
  readonly slot: number;
  readonly name: string;
  readonly color: string;
  readonly actuationMillimeters: number;
  readonly rapidTrigger: RapidTriggerSettings;
  readonly keyActuations: readonly KeyActuation[];
}

export interface KeyboardProfileReader {
  readActiveProfile(): Promise<KeyboardProfile>;
}
