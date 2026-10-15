import type { MatrixKey } from "../../keyboard/matrix-key";
import { type LayoutKey, matrixGridLayout, matrixKeyId, type PhysicalLayout } from "../../keyboard/physical-layout";

const NO_HID_USAGE = 0;

export interface BoardKey {
  readonly id: string;
  readonly layoutKey: LayoutKey;
  readonly matrixKey: MatrixKey;
}

export interface Board {
  readonly layout: PhysicalLayout;
  readonly keys: readonly BoardKey[];
}

export function boardFor(physicalLayout: PhysicalLayout | undefined, mappedKeys: readonly MatrixKey[]): Board {
  const layout = physicalLayout ?? matrixGridLayout("Key matrix", mappedKeys);
  const mapped = new Map(mappedKeys.map((key) => [matrixKeyId(key), key]));
  return {
    layout,
    keys: layout.keys.map((layoutKey) => {
      const id = matrixKeyId(layoutKey);
      const matrixKey = mapped.get(id) ?? {
        hidUsage: NO_HID_USAGE,
        matrixRow: layoutKey.matrixRow,
        matrixColumn: layoutKey.matrixColumn,
      };
      return { id, layoutKey, matrixKey };
    }),
  };
}

export function roundToStep(value: number, range: { readonly min: number; readonly step: number }): number {
  const steps = Math.round((value - range.min) / range.step);
  return Number((range.min + steps * range.step).toFixed(4));
}
