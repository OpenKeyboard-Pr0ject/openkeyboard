const MATRIX_COLUMN_BITS = 5;
const MATRIX_COLUMN_MASK = 0x1f;

export function matrixRowOf(position: number): number {
  return position >> MATRIX_COLUMN_BITS;
}

export function matrixColumnOf(position: number): number {
  return position & MATRIX_COLUMN_MASK;
}

export function matrixPositionOf(row: number, column: number): number {
  return (row << MATRIX_COLUMN_BITS) | column;
}
