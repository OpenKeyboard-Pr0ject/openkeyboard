import type { AnalogKeyReading } from "../../keyboard/analog-keys";

const ENTRY_BYTES = 4;
const MATRIX_COLUMN_BITS = 5;
const MATRIX_COLUMN_MASK = 0x1f;
const FULL_TRAVEL_VALUE = 0xffc1;

export function decodeWootingAnalogReport(report: Uint8Array): AnalogKeyReading[] {
  const view = new DataView(report.buffer, report.byteOffset, report.byteLength);
  const readings: AnalogKeyReading[] = [];
  for (let offset = 0; offset + ENTRY_BYTES <= report.length; offset += ENTRY_BYTES) {
    if (view.getUint32(offset) === 0) break;
    readings.push(decodeEntry(view, offset));
  }
  return readings;
}

function decodeEntry(view: DataView, offset: number): AnalogKeyReading {
  const matrixPosition = view.getUint8(offset);
  return {
    hidUsage: view.getUint8(offset + 1),
    matrixRow: matrixPosition >> MATRIX_COLUMN_BITS,
    matrixColumn: matrixPosition & MATRIX_COLUMN_MASK,
    depth: Math.min(view.getUint16(offset + 2, true) / FULL_TRAVEL_VALUE, 1),
  };
}
