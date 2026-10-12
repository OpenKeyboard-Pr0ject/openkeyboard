const DEFAULT_ALIGNMENT = 4;
const LABEL_SLOTS = 12;
const UNUSED_LABEL_SLOT = -1;

const LABEL_SLOT_BY_ALIGNMENT: readonly (readonly number[])[] = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
];

export class KleLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KleLayoutError";
  }
}

export interface KleKey {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly labels: readonly string[];
  readonly decal: boolean;
}

interface KleKeyProperties {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly h?: number;
  readonly a?: number;
  readonly d?: boolean;
  readonly rx?: number;
}

class KleCursor {
  x = 0;
  y = 0;
  width = 1;
  height = 1;
  decal = false;
  rowStartX = 0;
  alignment = DEFAULT_ALIGNMENT;

  apply(properties: KleKeyProperties): void {
    if (properties.rx !== undefined) this.rowStartX = properties.rx;
    if (properties.a !== undefined) this.alignment = properties.a;
    if (properties.x) this.x += properties.x;
    if (properties.y) this.y += properties.y;
    if (properties.w) this.width = properties.w;
    if (properties.h) this.height = properties.h;
    if (properties.d) this.decal = properties.d;
  }

  placeKey(legend: string): KleKey {
    const key = {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      labels: reorderLabels(legend.split("\n"), this.alignment),
      decal: this.decal,
    };
    this.x += this.width;
    this.width = 1;
    this.height = 1;
    this.decal = false;
    return key;
  }

  endRow(): void {
    this.y += 1;
    this.x = this.rowStartX;
  }
}

export function parseKleKeys(rows: unknown): KleKey[] {
  if (!Array.isArray(rows)) throw new KleLayoutError("The layout must be an array of rows.");
  const cursor = new KleCursor();
  const keys: KleKey[] = [];
  rows.forEach((row, rowIndex) => {
    if (Array.isArray(row)) {
      keys.push(...parseRow(row, cursor));
      cursor.endRow();
    } else if (rowIndex !== 0 || typeof row !== "object" || row === null) {
      throw new KleLayoutError(`Layout row ${rowIndex} is neither a row nor leading keyboard metadata.`);
    }
  });
  return keys;
}

function parseRow(row: readonly unknown[], cursor: KleCursor): KleKey[] {
  const keys: KleKey[] = [];
  for (const item of row) {
    if (typeof item === "string") keys.push(cursor.placeKey(item));
    else if (typeof item === "object" && item !== null) cursor.apply(item as KleKeyProperties);
    else throw new KleLayoutError("A layout row may only hold legends and key properties.");
  }
  return keys;
}

function reorderLabels(legends: readonly string[], alignment: number): string[] {
  const slots = LABEL_SLOT_BY_ALIGNMENT[alignment] ?? LABEL_SLOT_BY_ALIGNMENT[DEFAULT_ALIGNMENT];
  const labels: string[] = Array.from({ length: LABEL_SLOTS }, () => "");
  legends.forEach((legend, index) => {
    const slot = slots[index];
    if (legend !== "" && slot !== undefined && slot !== UNUSED_LABEL_SLOT) labels[slot] = legend;
  });
  return labels;
}
