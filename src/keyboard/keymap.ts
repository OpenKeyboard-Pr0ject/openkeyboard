export interface PhysicalKey {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly matrixRow: number;
  readonly matrixColumn: number;
}

export interface KeyAssignment {
  readonly code: number;
  readonly label: string;
}

export interface Keymap {
  readonly name: string;
  readonly physicalKeys: readonly PhysicalKey[];
  readonly layers: readonly (readonly (readonly KeyAssignment[])[])[];
}

export interface KeymapReader {
  readKeymap(): Promise<Keymap>;
}

export interface KeyboardDefinitionLoader {
  loadDefinition(definitionJson: string): void;
}

export class KeyboardDefinitionRequiredError extends Error {
  constructor() {
    super("This keyboard does not include its layout. Load its VIA definition file (.json) to show the keymap.");
    this.name = "KeyboardDefinitionRequiredError";
  }
}
