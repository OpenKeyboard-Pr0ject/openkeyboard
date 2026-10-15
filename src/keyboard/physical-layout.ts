import { keyLabel } from "./hid-key-names";
import type { PhysicalKey } from "./keymap";
import type { MatrixKey } from "./matrix-key";

export interface MatrixPosition {
  readonly matrixRow: number;
  readonly matrixColumn: number;
}

export interface LayoutKey extends PhysicalKey {
  readonly label: string;
}

export interface PhysicalLayout {
  readonly name: string;
  readonly keys: readonly LayoutKey[];
}

export interface LayoutSize {
  readonly width: number;
  readonly height: number;
}

const MATRIX_KEY_ID_SEPARATOR = ":";

export function matrixKeyId(position: MatrixPosition): string {
  return `${position.matrixRow}${MATRIX_KEY_ID_SEPARATOR}${position.matrixColumn}`;
}

export function matrixPositionFromKeyId(keyId: string): MatrixPosition {
  const [matrixRow, matrixColumn] = keyId.split(MATRIX_KEY_ID_SEPARATOR).map(Number);
  return { matrixRow, matrixColumn };
}

export function layoutSize(layout: PhysicalLayout): LayoutSize {
  return {
    width: Math.max(0, ...layout.keys.map((key) => key.x + key.width)),
    height: Math.max(0, ...layout.keys.map((key) => key.y + key.height)),
  };
}

export function matrixGridLayout(name: string, keys: readonly MatrixKey[]): PhysicalLayout {
  const seen = new Set<string>();
  const gridKeys: LayoutKey[] = [];
  for (const key of keys) {
    const id = matrixKeyId(key);
    if (seen.has(id)) continue;
    seen.add(id);
    gridKeys.push({
      x: key.matrixColumn,
      y: key.matrixRow,
      width: 1,
      height: 1,
      matrixRow: key.matrixRow,
      matrixColumn: key.matrixColumn,
      label: keyLabel(key),
    });
  }
  return { name, keys: gridKeys };
}
